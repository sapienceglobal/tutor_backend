import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Enrollment from '../models/Enrollment.js';
import Tutor from '../models/Tutor.js';
import Settings from '../models/Settings.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { featureFlags } from '../config/featureFlags.js';
import { getForUser as getEntitlementsForUser } from '../services/entitlementService.js';
import { evaluateAccess } from '../services/accessPolicy.js';
import { createNotification } from './notificationController.js';
import TutorStudentLink from '../models/TutorStudentLink.js';
import InstituteMembership from '../models/InstituteMembership.js';
import { checkPrivateCourseQuota } from '../middleware/subscriptionMiddleware.js';

// Helper to convert Cloudinary HLS URLs to secure backend proxy URLs
const secureHlsUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('cloudinary.com') || !url.includes('.m3u8')) return url;
  
  const match = url.match(/https:\/\/res\.cloudinary\.com\/(.+)/);
  if (match) {
    return `/api/proxy/upload/secure-hls/${match[1]}`;
  }
  return url;
};

// Helper to secure HLS video URLs inside a Lesson object
const secureLessonHls = (lesson) => {
  if (!lesson) return lesson;
  const lessonObj = typeof lesson.toObject === 'function' ? lesson.toObject() : lesson;
  if (lessonObj.content && lessonObj.content.videoUrl) {
    lessonObj.content.videoUrl = secureHlsUrl(lessonObj.content.videoUrl);
  }
  return lessonObj;
};
import {
  AUDIENCE_SCOPES,
  normalizeAudienceInput,
  validateAudience,
} from '../utils/audience.js';

const toIdStr = (val) => (val ? String(val._id || val) : null);

/**
 * Resolves closed-workspace audience for courses (Institute or Private Tutor Studio only).
 */
const resolveCourseAudience = ({ body, tutor, tenant, workspace }) => {
  const isPrivateWorkspace = workspace?.type === 'private_tutor'
    || (!workspace && !tenant?._id && !body?.instituteId && body?.scope !== 'institute');

  if (isPrivateWorkspace && (body?.scope === 'institute' || body?.visibilityScope === 'institute')) {
    throw new Error('Switch to your Institute workspace to publish institute courses.');
  }

  const targetInstituteId = isPrivateWorkspace
    ? null
    : (tenant?._id || workspace?.instituteId || body?.instituteId || tutor?.instituteId || null);

  const mappedScope = body?.scope === 'global' || body?.visibility === 'public'
    ? (isPrivateWorkspace ? AUDIENCE_SCOPES.TUTOR_NETWORK : AUDIENCE_SCOPES.INSTITUTE)
    : body?.scope;

  const mappedVisibilityScope = body?.visibilityScope === 'global'
    ? (isPrivateWorkspace ? AUDIENCE_SCOPES.TUTOR_NETWORK : AUDIENCE_SCOPES.INSTITUTE)
    : body?.visibilityScope;

  const normalizedAudience = normalizeAudienceInput({
    audience: body.audience,
    scope: mappedScope,
    visibility: body.visibility,
    visibilityScope: mappedVisibilityScope,
    instituteId: targetInstituteId,
    studentIds: body.studentIds,
  }, {
    defaultScope: isPrivateWorkspace ? AUDIENCE_SCOPES.TUTOR_NETWORK : AUDIENCE_SCOPES.INSTITUTE,
    defaultInstituteId: targetInstituteId,
  });

  if (normalizedAudience.scope === AUDIENCE_SCOPES.BATCH) {
    throw new Error('Batch scope is not supported for courses');
  }
  if (normalizedAudience.scope === AUDIENCE_SCOPES.GLOBAL) {
    normalizedAudience.scope = isPrivateWorkspace ? AUDIENCE_SCOPES.TUTOR_NETWORK : AUDIENCE_SCOPES.INSTITUTE;
  }
  if (normalizedAudience.scope === AUDIENCE_SCOPES.TUTOR_NETWORK || isPrivateWorkspace) {
    normalizedAudience.instituteId = null;
  }

  return validateAudience(normalizedAudience, {
    requireInstituteId: !isPrivateWorkspace && normalizedAudience.scope === AUDIENCE_SCOPES.INSTITUTE,
    allowEmptyPrivate: false,
  });
};

/**
 * Shared Course Pricing & Payout KYC policy guard.
 * Paid courses require verified Tutor payout KYC before enabling online payments in Private Studio.
 */
export const resolveCoursePricingPolicy = ({
  price,
  requestedPricingMode,
  offlinePaymentInstructions,
  tutor,
  isPrivateWorkspace,
}) => {
  const numericPrice = Math.max(0, Number(price) || 0);
  if (numericPrice <= 0) {
    return {
      ok: true,
      price: 0,
      isFree: true,
      pricingMode: 'free',
      offlinePaymentInstructions: '',
    };
  }

  const isPayoutVerified = tutor?.payoutAccount?.verificationStatus === 'verified';
  const normalizedMode = requestedPricingMode ? String(requestedPricingMode).trim().toLowerCase() : null;

  if (normalizedMode && !['offline', 'online'].includes(normalizedMode)) {
    return {
      ok: false,
      status: 400,
      code: 'INVALID_PRICING_MODE',
      message: 'Paid courses must use either offline or online pricingMode.',
    };
  }

  if (isPrivateWorkspace && normalizedMode === 'online' && !isPayoutVerified) {
    return {
      ok: false,
      status: 403,
      code: 'PAYOUT_KYC_REQUIRED',
      message: 'Please add and verify your Bank Account or UPI ID before enabling online payments for paid courses. Select offline fee mode meanwhile.',
    };
  }

  let effectiveMode = normalizedMode;
  if (!effectiveMode) {
    effectiveMode = isPrivateWorkspace
      ? (isPayoutVerified ? 'online' : 'offline')
      : 'online';
  }

  return {
    ok: true,
    price: numericPrice,
    isFree: false,
    pricingMode: effectiveMode,
    offlinePaymentInstructions: effectiveMode === 'offline'
      ? String(offlinePaymentInstructions || '').trim().slice(0, 1000)
      : '',
  };
};

// @desc    Get all published courses in active closed workspace
// @route   GET /api/courses
export const getAllCourses = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to browse workspace courses.',
      });
    }

    if (req.user.role !== 'superadmin' && (!req.hasActiveWorkspace || req.workspace?.type === 'none')) {
      return res.status(403).json({
        success: false,
        code: 'PORTAL_APPROVAL_REQUIRED',
        portalApprovalRequired: true,
        message: 'Your join request is awaiting approval from an Institute or Private Tutor.',
      });
    }

    const { categoryId, level, isFree, search, tutorId } = req.query;
    const filter = { status: 'published' };

    if (categoryId) filter.categoryId = categoryId;
    if (level) filter.level = level;
    if (isFree !== undefined) filter.isFree = isFree === 'true';

    if (req.workspace?.type === 'institute') {
      filter.instituteId = req.workspace.instituteId;
      if (tutorId) filter.tutorId = tutorId;
    } else if (req.workspace?.type === 'private_tutor') {
      filter.instituteId = null;
      if (req.user.role === 'tutor') {
        filter.tutorId = req.workspace.tutorId;
      } else if (req.user.role === 'student') {
        const activeIds = (req.workspace.activeTutorIds || []).map(String);
        const requestedTutorId = tutorId || req.workspace.filterTutorId || null;
        if (requestedTutorId) {
          if (!activeIds.includes(String(requestedTutorId))) {
            return res.status(403).json({
              success: false,
              code: 'TUTOR_NOT_LINKED',
              message: 'You do not have an approved connection with this Private Tutor.',
            });
          }
          filter.tutorId = requestedTutorId;
        } else {
          if (activeIds.length === 0) {
            return res.status(200).json({ success: true, count: 0, courses: [] });
          }
          filter.tutorId = { $in: activeIds };
        }
      }
    } else if (req.user.role === 'superadmin') {
      if (req.workspace?.instituteId) filter.instituteId = req.workspace.instituteId;
      else if (req.query.workspaceType === 'private_tutor') filter.instituteId = null;
      if (tutorId) filter.tutorId = tutorId;
    }

    let courses = await Course.find(filter)
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        select: 'userId instituteId isVerified privateTeaching payoutAccount.verificationStatus',
        populate: {
          path: 'userId',
          select: 'name profileImage isBlocked instituteId',
        },
      })
      .sort({ createdAt: -1 });

    let activeInstTutorUserIds = new Set();
    if (req.workspace?.type === 'institute' && req.workspace.instituteId) {
      const memberships = await InstituteMembership.find({
        instituteId: req.workspace.instituteId,
        roleInInstitute: 'tutor',
        status: 'active',
      }).select('userId').lean();
      activeInstTutorUserIds = new Set(memberships.map((m) => toIdStr(m.userId)));
    }

    courses = courses.filter((course) => {
      if (!course.tutorId || course.tutorId.userId?.isBlocked) return false;
      const isPrivateCourse = !course.instituteId;
      if (isPrivateCourse) {
        return course.tutorId.privateTeaching?.isEnabled !== false;
      }
      return Boolean(course.tutorId.isVerified || activeInstTutorUserIds.has(toIdStr(course.tutorId.userId)));
    });

    if (search) {
      const needle = search.toLowerCase();
      courses = courses.filter((course) => course.title.toLowerCase().includes(needle));
    }

    if (featureFlags.audienceEnforceV2 || featureFlags.audienceReadV2Shadow) {
      const entitlements = await getEntitlementsForUser(req.user, req.workspace?.instituteId || null);
      if (featureFlags.audienceEnforceV2) {
        courses = courses.filter((course) => evaluateAccess({
          resource: course,
          entitlements,
          ownerId: course?.createdBy || course?.tutorId?.userId?._id || null,
          requireEnrollment: false,
          requirePayment: false,
          isFree: true,
          legacyAllowed: true,
          shadowContext: { route: 'GET /api/courses', resourceType: 'course' },
        }).allowed);
      } else {
        courses.forEach((course) => {
          evaluateAccess({
            resource: course,
            entitlements,
            ownerId: course?.createdBy || course?.tutorId?.userId?._id || null,
            requireEnrollment: false,
            requirePayment: false,
            isFree: true,
            legacyAllowed: true,
            shadowContext: { route: 'GET /api/courses', resourceType: 'course' },
          });
        });
      }
    }

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get single course
// @route   GET /api/courses/:id
export const getCourseById = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access this course.',
      });
    }

    if (req.user.role !== 'superadmin' && (!req.hasActiveWorkspace || req.workspace?.type === 'none')) {
      return res.status(403).json({
        success: false,
        code: 'PORTAL_APPROVAL_REQUIRED',
        portalApprovalRequired: true,
        message: 'Your join request is awaiting approval from an Institute or Private Tutor.',
      });
    }

    const { id } = req.params;

    const course = await Course.findById(id)
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        select: 'userId instituteId isVerified privateTeaching payoutAccount.verificationStatus',
        populate: {
          path: 'userId',
          select: 'name profileImage isBlocked',
        },
      });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const userIdStr = String(req.user._id || req.user.id);
    const isInstructor = req.user.role === 'tutor' && toIdStr(course.tutorId?.userId) === userIdStr;

    const enrollment = await Enrollment.findOne({
      studentId: userIdStr,
      courseId: id,
    }).populate('batchId');

    const isEnrolled = Boolean(enrollment && ['active', 'completed'].includes(enrollment.status));

    // Closed-workspace isolation guard
    if (req.user.role !== 'superadmin' && !isInstructor) {
      const explicitWorkspace = (req.headers['x-workspace-type'] || '').toString().trim().toLowerCase();
      if (explicitWorkspace === 'private_tutor' && course.instituteId) {
        return res.status(403).json({
          success: false,
          code: 'WORKSPACE_ISOLATION_VIOLATION',
          message: 'Switch to your Institute workspace to view this institute course.',
        });
      }
      if (explicitWorkspace === 'institute' && !course.instituteId) {
        return res.status(403).json({
          success: false,
          code: 'WORKSPACE_ISOLATION_VIOLATION',
          message: 'Switch to your Private Tutor workspace to view this private course.',
        });
      }

      if (course.instituteId) {
        const instMatch = req.workspace?.membershipInstituteIds?.includes(toIdStr(course.instituteId))
          || toIdStr(req.user.instituteId) === toIdStr(course.instituteId)
          || await InstituteMembership.exists({ userId: userIdStr, instituteId: course.instituteId, status: 'active' });
        if (!instMatch && !isEnrolled) {
          return res.status(403).json({
            success: false,
            code: 'INSTITUTE_MEMBERSHIP_REQUIRED',
            message: 'You are not an approved member of this institute.',
          });
        }
      } else {
        const tutorIdStr = toIdStr(course.tutorId);
        const linked = (req.workspace?.activeTutorIds || []).includes(tutorIdStr)
          || await TutorStudentLink.exists({ studentId: userIdStr, tutorId: tutorIdStr, status: 'active' });
        if (!linked && !isEnrolled) {
          return res.status(403).json({
            success: false,
            code: 'TUTOR_NOT_LINKED',
            message: 'You must be connected with this Private Tutor to view their course.',
          });
        }
      }
    }

    if (featureFlags.audienceEnforceV2 && !isInstructor && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const entitlements = await getEntitlementsForUser(req.user, req.workspace?.instituteId || null);
      const audienceDecision = evaluateAccess({
        resource: course,
        entitlements,
        ownerId: course?.createdBy || course?.tutorId?.userId?._id || null,
        requireEnrollment: false,
        requirePayment: false,
        isFree: true,
        legacyAllowed: true,
        shadowContext: { route: 'GET /api/courses/:id', resourceType: 'course', resourceId: course?._id },
      });
      if (!audienceDecision.allowed && !isEnrolled) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this course in your current scope',
        });
      }
    } else if (featureFlags.audienceReadV2Shadow && !isInstructor && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      const entitlements = await getEntitlementsForUser(req.user, req.workspace?.instituteId || null);
      evaluateAccess({
        resource: course,
        entitlements,
        ownerId: course?.createdBy || course?.tutorId?.userId?._id || null,
        requireEnrollment: false,
        requirePayment: false,
        isFree: true,
        legacyAllowed: true,
        shadowContext: { route: 'GET /api/courses/:id', resourceType: 'course', resourceId: course?._id },
      });
    }

    const isPrivateCourse = !course.instituteId;
    const isTutorVerified = isPrivateCourse
      ? (course.tutorId?.privateTeaching?.isEnabled !== false)
      : Boolean(course.tutorId?.isVerified);
    const isTutorBlocked = Boolean(course.tutorId?.userId?.isBlocked);
    const isCourseAvailable = course.status === 'published' && isTutorVerified && !isTutorBlocked;

    if (req.user.role === 'tutor' && !isInstructor) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: Tutors can only preview their own created courses.',
      });
    }

    if (!isCourseAvailable) {
      const isInstAdmin = req.user.role === 'admin'
        && course.instituteId
        && toIdStr(course.instituteId) === toIdStr(req.workspace?.instituteId || req.user.instituteId);
      const canAccess = req.user.role === 'superadmin' || isInstAdmin || isInstructor || isEnrolled;

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: 'This course is currently unavailable or suspended, and cannot be accessed.',
        });
      }
    }

    let lessons = await Lesson.find({ courseId: id, isPublished: true }).sort({ order: 1 });
    lessons = lessons.map((lesson) => secureLessonHls(lesson));

    res.status(200).json({
      success: true,
      course,
      lessons,
      isEnrolled,
      enrollmentStatus: enrollment?.status || null,
      isInstructor,
      enrollment,
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Create course (Tutor only)
// @route   POST /api/courses
export const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      thumbnail,
      categoryId,
      price,
      pricingMode,
      offlinePaymentInstructions,
      level,
      duration,
      language,
      modules,
      requirements,
      whatYouWillLearn,
    } = req.body;

    if (!title || !description || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and category are required',
      });
    }

    const tutor = await Tutor.findOne({ userId: req.user.id });
    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can create courses',
      });
    }

    const isPrivateWorkspace = req.workspace?.type === 'private_tutor'
      || (!req.tenant && !req.workspace?.instituteId && req.body?.scope !== 'institute');

    if (isPrivateWorkspace) {
      if (tutor.privateTeaching?.isEnabled === false) {
        return res.status(403).json({
          success: false,
          code: 'PRIVATE_STUDIO_DISABLED',
          message: 'Private Studio is disabled on your tutor profile.',
        });
      }

      const courseQuota = await checkPrivateCourseQuota(tutor._id, req.user._id || req.user.id);
      if (!courseQuota.allowed) {
        return res.status(403).json({
          success: false,
          code: 'PRIVATE_COURSE_LIMIT_REACHED',
          limitReached: true,
          upgradeRequired: true,
          currentCount: courseQuota.currentCount,
          maxAllowed: courseQuota.maxAllowed,
          message: `Private course limit reached (${courseQuota.currentCount}/${courseQuota.maxAllowed}). Upgrade your Tutor plan to create more private courses.`,
        });
      }
    }

    let audience;
    try {
      audience = resolveCourseAudience({
        body: req.body,
        tutor,
        tenant: req.tenant,
        workspace: req.workspace,
      });
    } catch (audienceError) {
      return res.status(400).json({
        success: false,
        message: audienceError.message,
      });
    }

    const pricingResult = resolveCoursePricingPolicy({
      price,
      requestedPricingMode: pricingMode,
      offlinePaymentInstructions,
      tutor,
      isPrivateWorkspace,
    });
    if (!pricingResult.ok) {
      return res.status(pricingResult.status).json({
        success: false,
        code: pricingResult.code,
        message: pricingResult.message,
      });
    }

    const resolvedInstituteId = isPrivateWorkspace
      ? null
      : (req.workspace?.instituteId || req.tenant?._id || audience.instituteId || tutor.instituteId || null);

    if (isPrivateWorkspace) {
      audience.instituteId = null;
      if (audience.scope !== AUDIENCE_SCOPES.PRIVATE) {
        audience.scope = AUDIENCE_SCOPES.TUTOR_NETWORK;
      }
    }

    const settings = await Settings.findOne();
    const autoApprove = isPrivateWorkspace || !settings || settings.autoApproveCourses !== false;

    const course = await Course.create({
      title,
      description,
      thumbnail,
      categoryId,
      tutorId: tutor._id,
      instituteId: resolvedInstituteId,
      createdBy: req.user.id,
      status: autoApprove ? 'published' : 'pending',
      isAIGenerated: req.body.isAIGenerated || false,
      price: pricingResult.price,
      isFree: pricingResult.isFree,
      pricingMode: pricingResult.pricingMode,
      offlinePaymentInstructions: pricingResult.offlinePaymentInstructions,
      level: level || 'beginner',
      duration: duration || 0,
      language: language || 'English',
      modules: modules || [],
      requirements: requirements || [],
      whatYouWillLearn: whatYouWillLearn || [],
      visibility: isPrivateWorkspace ? 'public' : 'institute',
      visibilityScope: isPrivateWorkspace
        ? (audience.scope === AUDIENCE_SCOPES.PRIVATE ? 'private' : 'tutor_network')
        : (audience.scope === AUDIENCE_SCOPES.PRIVATE ? 'private' : 'institute'),
      audience,
    });

    const populatedCourse = await Course.findById(course._id)
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        populate: {
          path: 'userId',
          select: 'name profileImage',
        },
      });

    res.status(201).json({
      success: true,
      message: autoApprove
        ? 'Course created and published successfully!'
        : 'Course submitted for review. It will be visible after admin approval.',
      course: populatedCourse,
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Update course (Tutor only - own courses)
// @route   PATCH /api/courses/:id
export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id).populate('tutorId');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if user owns this course
    if (course.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this course',
      });
    }

    const isPrivateCourse = !course.instituteId;

    const allowedUpdates = [
      'title', 'description', 'thumbnail', 'categoryId',
      'level', 'duration', 'language', 'modules',
      'requirements', 'whatYouWillLearn', 'status',
      'audience', 'enrollmentSettings',
    ];

    let publishMessage = 'Course updated successfully';

    if (req.body.status === 'published') {
      const settings = await Settings.findOne();
      if (!isPrivateCourse && settings && settings.autoApproveCourses === false) {
        req.body.status = 'pending';
        publishMessage = 'Course submitted for review. It will be visible after admin approval.';
      } else {
        publishMessage = 'Course published successfully!';
      }
    }

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        course[field] = req.body[field];
      }
    });

    if (
      req.body.price !== undefined
      || req.body.pricingMode !== undefined
      || req.body.offlinePaymentInstructions !== undefined
    ) {
      const nextPrice = req.body.price !== undefined ? req.body.price : course.price;
      const requestedMode = req.body.pricingMode !== undefined
        ? req.body.pricingMode
        : (Number(nextPrice) > 0 && course.pricingMode === 'free' ? undefined : course.pricingMode);

      const pricingResult = resolveCoursePricingPolicy({
        price: nextPrice,
        requestedPricingMode: requestedMode,
        offlinePaymentInstructions: req.body.offlinePaymentInstructions !== undefined
          ? req.body.offlinePaymentInstructions
          : course.offlinePaymentInstructions,
        tutor: course.tutorId,
        isPrivateWorkspace: isPrivateCourse,
      });
      if (!pricingResult.ok) {
        return res.status(pricingResult.status).json({
          success: false,
          code: pricingResult.code,
          message: pricingResult.message,
        });
      }
      course.price = pricingResult.price;
      course.isFree = pricingResult.isFree;
      course.pricingMode = pricingResult.pricingMode;
      course.offlinePaymentInstructions = pricingResult.offlinePaymentInstructions;
    }

    if (
      req.body.audience !== undefined
      || req.body.scope !== undefined
      || req.body.visibility !== undefined
      || req.body.visibilityScope !== undefined
      || req.body.studentIds !== undefined
    ) {
      let audience;
      try {
        audience = resolveCourseAudience({
          body: req.body,
          tutor: course.tutorId,
          tenant: req.tenant,
          workspace: {
            type: isPrivateCourse ? 'private_tutor' : 'institute',
            instituteId: course.instituteId || null,
          },
        });
      } catch (audienceError) {
        return res.status(400).json({
          success: false,
          message: audienceError.message,
        });
      }

      course.audience = audience;
      if (isPrivateCourse) {
        course.visibility = 'public';
        course.visibilityScope = audience.scope === AUDIENCE_SCOPES.PRIVATE ? 'private' : 'tutor_network';
        course.instituteId = null;
      } else {
        course.visibility = 'institute';
        course.visibilityScope = audience.scope === AUDIENCE_SCOPES.PRIVATE ? 'private' : 'institute';
        course.instituteId = audience.instituteId || course.instituteId || req.tenant?._id || null;
      }
    } else if (!course.visibilityScope || course.visibilityScope === 'global') {
      course.visibilityScope = isPrivateCourse ? 'tutor_network' : 'institute';
    }

    if (!course.createdBy && req.user) {
      course.createdBy = req.user.id;
    }

    await course.save();

    const updatedCourse = await Course.findById(id)
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        populate: {
          path: 'userId',
          select: 'name profileImage',
        },
      });

    res.status(200).json({
      success: true,
      message: publishMessage,
      course: updatedCourse,
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Delete course (Tutor only - own courses)
// @route   DELETE /api/courses/:id
export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id).populate('tutorId');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if user owns this course
    if (course.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this course',
      });
    }

    // Check if course has enrollments
    const enrollmentCount = await Enrollment.countDocuments({ courseId: id });
    if (enrollmentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete course. ${enrollmentCount} students are enrolled`,
      });
    }

    // Delete all lessons
    await Lesson.deleteMany({ courseId: id });

    await course.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully',
    });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get courses by tutor
// @route   GET /api/courses/tutor/:tutorId
export const getCoursesByTutor = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (req.user.role !== 'superadmin' && (!req.hasActiveWorkspace || req.workspace?.type === 'none')) {
      return res.status(403).json({
        success: false,
        code: 'PORTAL_APPROVAL_REQUIRED',
        message: 'Your join request is awaiting approval from an Institute or Private Tutor.',
      });
    }

    const { tutorId } = req.params;
    const filter = { tutorId, status: 'published' };

    if (req.workspace?.type === 'private_tutor') {
      if (req.user.role === 'student' && !(req.workspace.activeTutorIds || []).includes(String(tutorId))) {
        return res.status(403).json({
          success: false,
          code: 'TUTOR_NOT_LINKED',
          message: 'You are not connected with this Private Tutor.',
        });
      }
      filter.instituteId = null;
    } else if (req.workspace?.type === 'institute') {
      filter.instituteId = req.workspace.instituteId;
    }

    const courses = await Course.find(filter)
      .populate('categoryId', 'name icon')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
    });
  } catch (error) {
    console.error('Get tutor courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get my courses (Tutor's own courses in active workspace)
// @route   GET /api/courses/my-courses
export const getMyCourses = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id || req.user._id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const filter = { tutorId: tutor._id };
    if (req.workspace?.type === 'private_tutor') {
      filter.instituteId = null;
    } else if (req.workspace?.type === 'institute' && req.workspace.instituteId) {
      filter.instituteId = req.workspace.instituteId;
    }

    const courses = await Course.find(filter)
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        populate: {
          path: 'userId',
          select: 'name profileImage',
        }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
    });
  } catch (error) {
    console.error('Get my courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get course students with details (Tutor only)
// @route   GET /api/courses/:id/students
export const getCourseStudentsDetailed = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if course exists and user owns it
    const course = await Course.findById(id).populate('tutorId');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    if (course.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view students',
      });
    }

    // Get all enrollments with student details
    const enrollments = await Enrollment.find({ courseId: id })
      .populate('studentId', 'name email phone profileImage')
      .sort({ enrolledAt: -1 });

    // Get lesson count for progress calculation
    const totalLessons = await Lesson.countDocuments({ courseId: id });

    // Format student data with progress
    const students = enrollments.map(enrollment => ({
      enrollmentId: enrollment._id,
      student: enrollment.studentId,
      enrolledAt: enrollment.enrolledAt,
      lastAccessed: enrollment.lastAccessed,
      status: enrollment.status,
      progress: {
        percentage: enrollment.progress.percentage,
        completedLessons: enrollment.progress.completedLessons.length,
        totalLessons,
      },
      completedAt: enrollment.completedAt,
    }));

    res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error('Get course students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Add announcement to course
// @route   POST /api/courses/:id/announcements
// @access  Private (Admin or Tutor)
export const addCourseAnnouncement = async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Verify tutor ownership
    if (req.user.role === 'tutor') {
      const tutor = await mongoose.model('Tutor').findOne({ userId: req.user._id });
      if (!tutor || course.tutorId.toString() !== tutor._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to add announcement to this course' });
      }
    }

    course.announcements.push({ title, message, createdAt: new Date() });
    await course.save();

    try {
      const enrollments = await Enrollment.find({ courseId: course._id, status: 'active' }).select('studentId');
      await Promise.allSettled(
        enrollments.map((enrollment) =>
          createNotification({
            userId: enrollment.studentId,
            type: 'announcement',
            title: `Course Announcement: ${title}`,
            message,
            data: { courseId: course._id },
          })
        )
      );
    } catch (notificationError) {
      console.error('Course announcement notification error:', notificationError);
    }

    res.status(201).json({
      success: true,
      message: 'Announcement posted successfully',
      announcements: course.announcements,
    });
  } catch (error) {
    console.error('Add course announcement error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get student's in-progress courses
// @route   GET /api/courses/in-progress
// @access  Private (Student)
export const getInProgressCourses = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({
      studentId: req.user.id,
      status: 'active',
    }).populate('courseId');

    const courses = enrollments
      .filter((e) => {
        if (!e.courseId) return false;
        if (req.workspace?.type === 'private_tutor') {
          if (e.courseId.instituteId) return false;
          if (req.workspace.filterTutorId) {
            return toIdStr(e.courseId.tutorId) === String(req.workspace.filterTutorId);
          }
          return true;
        }
        if (req.workspace?.type === 'institute' && req.workspace.instituteId) {
          return toIdStr(e.courseId.instituteId) === String(req.workspace.instituteId);
        }
        return true;
      })
      .map((e) => ({
        _id: e.courseId._id,
        title: e.courseId.title,
        progress: e.progress?.percentage || 0,
      }));

    res.status(200).json({
      success: true,
      courses
    });
  } catch (error) {
    console.error('Get in-progress courses error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

//SuperAdmin 

