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
import {
  AUDIENCE_SCOPES,
  normalizeAudienceInput,
  validateAudience,
} from '../utils/audience.js';

const resolveCourseAudience = ({ body, tutor, tenant }) => {
  const normalizedAudience = normalizeAudienceInput({
    audience: body.audience,
    scope: body.scope,
    visibility: body.visibility,
    visibilityScope: body.visibilityScope,
    instituteId: body.instituteId || tutor?.instituteId || tenant?._id || null,
    studentIds: body.studentIds,
  }, {
    defaultScope: tutor?.instituteId ? AUDIENCE_SCOPES.INSTITUTE : AUDIENCE_SCOPES.GLOBAL,
    defaultInstituteId: tutor?.instituteId || tenant?._id || null,
  });

  if (normalizedAudience.scope === AUDIENCE_SCOPES.BATCH) {
    throw new Error('Batch scope is not supported for courses');
  }

  return validateAudience(normalizedAudience, {
    requireInstituteId: false,
    allowEmptyPrivate: false,
  });
};

// @desc    Get all published courses
// @route   GET /api/courses
export const getAllCourses = async (req, res) => {
  try {

    const { categoryId, level, isFree, search, tutorId, scope } = req.query;

    // Check Guest Browsing Settings
    const settings = await Settings.findOne();
    if (settings && settings.allowGuestBrowsing === false) {
      let token;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Guest browsing is currently disabled. Please log in to view courses.'
        });
      }

      try {
        jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in to view courses.'
        });
      }
    }

    let filter = { status: 'published' };

    if (categoryId) filter.categoryId = categoryId;
    if (level) filter.level = level;
    if (isFree !== undefined) filter.isFree = isFree === 'true';
    if (tutorId) filter.tutorId = tutorId;

    // Multi-tenancy Scope Logic (Global vs Institute)
    if (scope === 'global') {
      // Show courses that are explicitly public OR courses without an institute (inherently global)
      filter.$or = [
        { visibility: 'public' },
        { instituteId: null },
        { instituteId: { $exists: false } }
      ];
    } else if (scope === 'institute' && req.user) {
      filter.visibility = 'institute';

      // Get User's institute
      const user = await User.findById(req.user.id);
      if (user && user.instituteId) {
        filter.instituteId = user.instituteId;
      } else {
        // If scope is institute but user doesn't belong to one, fail safely
        return res.status(400).json({
          success: false,
          message: 'You are not enrolled in any institute.',
          courses: []
        });
      }
    } else {
      // Default behavior if no scope provided: Show Global + User's Institute Courses
      if (req.user) {
        const user = await User.findById(req.user.id);
        if (user && user.instituteId) {
          filter.$or = [
            { visibility: 'public' },
            { visibility: 'institute', instituteId: user.instituteId }
          ];
        } else {
          filter.visibility = 'public';
        }
      } else {
        filter.visibility = 'public'; // Guests only see public
      }
    }

    let courses = await Course.find(filter)
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        populate: {
          path: 'userId',
          select: 'name profileImage isBlocked instituteId',
        },
      })
      .sort({ createdAt: -1 });

    // Filter out courses with unverified/blocked tutors
    courses = courses.filter(course => {
      const isIndependent = course.tutorId && !course.tutorId.instituteId;
      // Independent global tutors can have their courses discovered instantly.
      // Institute tutors still need to be verified by their institute admin.
      const isTutorVerified = isIndependent || (course.tutorId && course.tutorId.isVerified);
      const isUserBlocked = course.tutorId && course.tutorId.userId && course.tutorId.userId.isBlocked;
      return isTutorVerified && !isUserBlocked;
    });

    // Search by title
    if (search) {
      courses = courses.filter(course =>
        course.title.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (featureFlags.audienceEnforceV2 || (featureFlags.audienceReadV2Shadow && req.user)) {
      if (!req.user) {
        if (featureFlags.audienceEnforceV2) {
          courses = courses.filter((course) => (
            course?.audience?.scope === AUDIENCE_SCOPES.GLOBAL || course.visibility === 'public'
          ));
        }
      } else {
        const entitlements = await getEntitlementsForUser(req.user);
        if (featureFlags.audienceEnforceV2) {
          courses = courses.filter((course) => evaluateAccess({
            resource: course,
            entitlements,
            ownerId: course?.createdBy || course?.tutorId?.userId?._id || null,
            requireEnrollment: false,
            requirePayment: false,
            isFree: true,
            legacyAllowed: true,
            shadowContext: {
              route: 'GET /api/courses',
              resourceType: 'course',
            },
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
              shadowContext: {
                route: 'GET /api/courses',
                resourceType: 'course',
              },
            });
          });
        }
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
    const { id } = req.params;

    const course = await Course.findById(id)
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        populate: {
          path: 'userId',
          select: 'name email phone profileImage',
        },
      });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if user is enrolled (if authenticated)
    let isEnrolled = false;
    let isInstructor = false;
    let enrollment = null;

    if (req.user) {
      enrollment = await Enrollment.findOne({
        studentId: req.user.id,
        courseId: id,
      }).populate('batchId');
      isEnrolled = !!enrollment;

      if (req.user.role === 'tutor' && course.tutorId?.userId?._id?.toString() === req.user.id) {
        isInstructor = true;
      }

      if (featureFlags.audienceEnforceV2 && !isInstructor && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        const entitlements = await getEntitlementsForUser(req.user);
        const audienceDecision = evaluateAccess({
          resource: course,
          entitlements,
          ownerId: course?.createdBy || course?.tutorId?.userId?._id || null,
          requireEnrollment: false,
          requirePayment: false,
          isFree: true,
          legacyAllowed: true,
          shadowContext: {
            route: 'GET /api/courses/:id',
            resourceType: 'course',
            resourceId: course?._id,
          },
        });
        if (!audienceDecision.allowed && !isEnrolled) {
          return res.status(403).json({
            success: false,
            message: 'You do not have access to this course in your current scope',
          });
        }
      } else if (featureFlags.audienceReadV2Shadow && !isInstructor && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        const entitlements = await getEntitlementsForUser(req.user);
        evaluateAccess({
          resource: course,
          entitlements,
          ownerId: course?.createdBy || course?.tutorId?.userId?._id || null,
          requireEnrollment: false,
          requirePayment: false,
          isFree: true,
          legacyAllowed: true,
          shadowContext: {
            route: 'GET /api/courses/:id',
            resourceType: 'course',
            resourceId: course?._id,
          },
        });
      }
    }

    // Determine if the course is publicly available
    // A course is available if it's published AND its tutor is verified/not blocked
   // ✅ FIX: Determine if the course is publicly available (Matching getAllCourses logic)
    const isIndependent = course.tutorId && !course.tutorId.instituteId;
    
    // Independent tutors bypass the verification check for publishing global courses
    const isTutorVerified = isIndependent || (course.tutorId && course.tutorId.isVerified);
    const isTutorBlocked = course.tutorId && course.tutorId.userId && course.tutorId.userId.isBlocked;
    
    const isCourseAvailable = course.status === 'published' && isTutorVerified && !isTutorBlocked;

    // Security: Strict Role-Based Access Control
    // 1. Tutors can ONLY access their own courses (unless they somehow enrolled as a student, but tutors shouldn't act as students).
    if (req.user && req.user.role === 'tutor' && !isInstructor) {
      return res.status(403).json({
        success: false,
        message: `Access Denied: Tutors can only preview their own created courses.`,
      });
    }

    // Security: Block access to unavailable courses for non-enrolled students
    if (!isCourseAvailable) {
      let canAccess = false;
      if (req.user) {
        if (req.user.role === 'admin') canAccess = true;
        // Check if user is the tutor who created the course
        if (isInstructor) {
          canAccess = true;
        }
        // Check if user is already enrolled (retain access principle)
        if (isEnrolled) {
          canAccess = true;
        }
      }

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: `This course is currently unavailable or suspended, and cannot be accessed.`,
        });
      }
    }

    // Get lessons for this course
    const lessons = await Lesson.find({ courseId: id, isPublished: true })
      .sort({ order: 1 });

    res.status(200).json({
      success: true,
      course,
      lessons,
      isEnrolled,
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
      level,
      duration,
      language,
      modules,
      requirements,
      whatYouWillLearn,
      visibility,
    } = req.body;

    if (!title || !description || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and category are required',
      });
    }

    // Get tutor profile
    const tutor = await Tutor.findOne({ userId: req.user.id });
    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can create courses',
      });
    }

    let audience;
    try {
      audience = resolveCourseAudience({
        body: req.body,
        tutor,
        tenant: req.tenant,
      });
    } catch (audienceError) {
      return res.status(400).json({
        success: false,
        message: audienceError.message,
      });
    }

    const tutorInstituteId = tutor.instituteId || req.tenant?._id || null;

    if (
      tutorInstituteId
      && audience.scope === AUDIENCE_SCOPES.GLOBAL
      && req.tenant?.features?.allowGlobalPublishingByInstituteTutors !== true
    ) {
      return res.status(403).json({
        success: false,
        message: 'Institute policy blocks global publishing for institute tutors',
      });
    }
    // Independent/global tutors have no institute admin to approve them
    // → always auto-publish and force global visibility.
    const isIndependentTutor = !tutorInstituteId;
    
    if (isIndependentTutor) {
      audience.scope = AUDIENCE_SCOPES.GLOBAL;
      audience.instituteId = null;
    }

    const isGlobal = audience.scope === AUDIENCE_SCOPES.GLOBAL;
    const resolvedInstituteId = isGlobal ? null : (audience.instituteId || tutorInstituteId || null);

    const settings = await Settings.findOne();
    const autoApprove = isIndependentTutor || !settings || settings.autoApproveCourses !== false;

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
      price: price || 0,
      level: level || 'beginner',
      duration: duration || 0,
      language: language || 'English',
      modules: modules || [],
      requirements: requirements || [],
      whatYouWillLearn: whatYouWillLearn || [],
      visibility: isGlobal ? 'public' : 'institute',
      visibilityScope: isGlobal ? 'global' : 'institute',
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

    const allowedUpdates = [
      'title', 'description', 'thumbnail', 'categoryId',
      'price', 'level', 'duration', 'language', 'modules',
      'requirements', 'whatYouWillLearn', 'status', 'visibility',
      'audience', 'enrollmentSettings',
    ];

    let publishMessage = 'Course updated successfully';

    // Intercept Publish Request based on Admin Auto-Approve Setting
    if (req.body.status === 'published') {
      const settings = await Settings.findOne();
      const isIndependentTutor = !(course.tutorId?.instituteId || req.tenant?._id);
      
      if (!isIndependentTutor && settings && settings.autoApproveCourses === false) {
        // Force status to pending if auto-approve is disabled for institute tutors
        req.body.status = 'pending';
        publishMessage = 'Course submitted for review. It will be visible after admin approval.';
      } else {
        publishMessage = 'Course published successfully!';
      }
    }

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        course[field] = req.body[field];
      }
    });

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
        });
      } catch (audienceError) {
        return res.status(400).json({
          success: false,
          message: audienceError.message,
        });
      }

      if (
        (course.tutorId?.instituteId || req.tenant?._id)
        && audience.scope === AUDIENCE_SCOPES.GLOBAL
        && req.tenant?.features?.allowGlobalPublishingByInstituteTutors !== true
      ) {
        return res.status(403).json({
          success: false,
          message: 'Institute policy blocks global publishing for institute tutors',
        });
      }

      course.audience = audience;
      course.visibility = audience.scope === AUDIENCE_SCOPES.GLOBAL ? 'public' : 'institute';
      if (audience.scope !== AUDIENCE_SCOPES.GLOBAL) {
      course.instituteId = audience.instituteId || course.tutorId?.instituteId || req.tenant?._id || null;
      } else {
        course.instituteId = null;
      }
    }

    // Safety Fallbacks & Concept Sync for legacy courses/plugins
    if (req.body.visibility) {
      // Sync Course.visibility with visibilityScopePlugin's visibilityScope
      course.visibilityScope = req.body.visibility === 'public' ? 'global' : 'institute';
    } else if (!course.visibilityScope) {
      // Default fallback for legacy records
      course.visibilityScope = course.visibility === 'public' ? 'global' : 'institute';
    }

    if (!course.createdBy && req.user) {
      course.createdBy = req.user.id;
    }

    // Ensure instituteId is present if scope is institute
    if (course.visibilityScope === 'institute' && !course.instituteId) {
      course.instituteId = req.tenant?._id || course.tutorId?.instituteId || null;
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
    const { tutorId } = req.params;

    const filter = { tutorId, status: 'published' };
    // Show all published courses for this tutor (no institute restriction)
    // This endpoint is used for public tutor profiles

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

// @desc    Get my courses (Tutor's own courses)
// @route   GET /api/courses/my-courses
export const getMyCourses = async (req, res) => {
try {
    // ✅ FIX: Safe ID mapping
    const tutor = await Tutor.findOne({ userId: req.user.id || req.user._id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }
    // Institute filter remove karo — tutor ke saare courses dikhao
    // (global + institute dono)
    const filter = { tutorId: tutor._id };
    //else----
    // if (tutor.instituteId) {
    //   filter.instituteId = tutor.instituteId;
    // }

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





//SuperAdmin 

