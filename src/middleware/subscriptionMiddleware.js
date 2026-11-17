import mongoose from 'mongoose';
import Institute from '../models/Institute.js';
import InstituteMembership from '../models/InstituteMembership.js';
import Tutor from '../models/Tutor.js';
import TutorStudentLink from '../models/TutorStudentLink.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import { getTutorFreeSubscriptionConfig } from '../config/planDefaults.js';

const resolveTutorOwnerUserId = async (tutorId) => {
    if (!tutorId) return null;
    const tutor = await Tutor.findById(tutorId).select('userId').lean();
    return tutor?.userId || null;
};

const hasFeatureEnabled = (features = {}, featureKey) => {
    if (!features) return false;
    if (features[featureKey] === true) return true;
    if (featureKey === 'aiFeatures') {
        return Boolean(
            features.aiFeatures === true
            || features.aiAssistant === true
            || features.aiAssessment === true
            || features.aiIntelligence === true
        );
    }
    return false;
};

/**
 * Helper: Dynamic Context Resolver
 * Resolves the ownership & billing context of the target asset (Course, Exam, Batch, Lesson, Session).
 */
const resolveAssetContext = async (req) => {
    const {
        courseId,
        examId,
        lessonId,
        batchId,
        lectureId,
        chatSessionId,
        sessionId,
        isPersonal,
        tutorId,
    } = {
        ...(req.body || {}),
        ...(req.query || {}),
        ...(req.params || {}),
    };

    const isPersonalParam = isPersonal === 'true' || isPersonal === true;
    const reqInstituteId = req.body?.instituteId || req.query?.instituteId;
    const reqTutorId = tutorId || req.headers['x-tutor-id'] || null;

    if (!isPersonalParam && !courseId && !examId && !lessonId && !batchId && !lectureId && !chatSessionId && !sessionId && !reqInstituteId && !reqTutorId) {
        return null;
    }

    try {
        if (isPersonalParam) {
            const resolvedTutorId = reqTutorId || req.workspace?.filterTutorId || req.workspace?.tutorId || null;
            const ownerUserId = resolvedTutorId
                ? await resolveTutorOwnerUserId(resolvedTutorId)
                : (req.workspace?.tutorUserId || null);
            return { isPersonalAsset: true, instituteId: null, tutorId: resolvedTutorId, ownerUserId };
        }

        if (reqInstituteId) {
            return { isPersonalAsset: false, instituteId: reqInstituteId, tutorId: null, ownerUserId: null };
        }

        if (courseId) {
            const CourseModel = mongoose.model('Course');
            const course = await CourseModel.findById(courseId).select('instituteId tutorId createdBy').lean();
            if (course) {
                if (course.instituteId) {
                    return { isPersonalAsset: false, instituteId: course.instituteId, tutorId: course.tutorId || null, ownerUserId: course.createdBy || null };
                }
                const ownerUserId = course.createdBy || await resolveTutorOwnerUserId(course.tutorId);
                return { isPersonalAsset: true, instituteId: null, tutorId: course.tutorId || null, ownerUserId };
            }
        }

        if (examId) {
            const ExamModel = mongoose.model('Exam');
            const exam = await ExamModel.findById(examId).select('instituteId tutorId').lean();
            if (exam) {
                if (exam.instituteId) {
                    return { isPersonalAsset: false, instituteId: exam.instituteId, tutorId: exam.tutorId || null, ownerUserId: null };
                }
                const ownerUserId = await resolveTutorOwnerUserId(exam.tutorId);
                return { isPersonalAsset: true, instituteId: null, tutorId: exam.tutorId || null, ownerUserId };
            }
        }

        if (batchId) {
            const BatchModel = mongoose.model('Batch');
            const batch = await BatchModel.findById(batchId).select('instituteId tutorId createdBy').lean();
            if (batch) {
                if (batch.instituteId) {
                    return { isPersonalAsset: false, instituteId: batch.instituteId, tutorId: batch.tutorId || null, ownerUserId: batch.createdBy || null };
                }
                const ownerUserId = batch.createdBy || await resolveTutorOwnerUserId(batch.tutorId);
                return { isPersonalAsset: true, instituteId: null, tutorId: batch.tutorId || null, ownerUserId };
            }
        }

        if (lessonId) {
            const LessonModel = mongoose.model('Lesson');
            const lesson = await LessonModel.findById(lessonId).select('courseId').lean();
            if (lesson?.courseId) {
                const CourseModel = mongoose.model('Course');
                const course = await CourseModel.findById(lesson.courseId).select('instituteId tutorId createdBy').lean();
                if (course) {
                    if (course.instituteId) {
                        return { isPersonalAsset: false, instituteId: course.instituteId, tutorId: course.tutorId || null, ownerUserId: course.createdBy || null };
                    }
                    const ownerUserId = course.createdBy || await resolveTutorOwnerUserId(course.tutorId);
                    return { isPersonalAsset: true, instituteId: null, tutorId: course.tutorId || null, ownerUserId };
                }
            }
        }

        if (lectureId) {
            const LectureSummaryModel = mongoose.model('LectureSummary');
            const lecture = await LectureSummaryModel.findById(lectureId).select('instituteId userId courseId').lean();
            if (lecture) {
                if (lecture.instituteId) {
                    return { isPersonalAsset: false, instituteId: lecture.instituteId, tutorId: null, ownerUserId: lecture.userId || null };
                }
                if (lecture.courseId) {
                    const CourseModel = mongoose.model('Course');
                    const course = await CourseModel.findById(lecture.courseId).select('instituteId tutorId createdBy').lean();
                    if (course) {
                        if (course.instituteId) {
                            return { isPersonalAsset: false, instituteId: course.instituteId, tutorId: course.tutorId || null, ownerUserId: course.createdBy || null };
                        }
                        const ownerUserId = course.createdBy || await resolveTutorOwnerUserId(course.tutorId);
                        return { isPersonalAsset: true, instituteId: null, tutorId: course.tutorId || null, ownerUserId };
                    }
                }
                return { isPersonalAsset: true, instituteId: null, tutorId: null, ownerUserId: lecture.userId || null };
            }
        }

        const sessId = chatSessionId || sessionId || req.params.id;
        if (sessId && mongoose.Types.ObjectId.isValid(sessId)) {
            const AIChatSessionModel = mongoose.model('AIChatSession');
            const session = await AIChatSessionModel.findById(sessId).select('instituteId courseId').lean();
            if (session) {
                if (session.instituteId) {
                    return { isPersonalAsset: false, instituteId: session.instituteId, tutorId: null, ownerUserId: null };
                }
                if (session.courseId) {
                    const CourseModel = mongoose.model('Course');
                    const course = await CourseModel.findById(session.courseId).select('instituteId tutorId createdBy').lean();
                    if (course) {
                        if (course.instituteId) {
                            return { isPersonalAsset: false, instituteId: course.instituteId, tutorId: course.tutorId || null, ownerUserId: course.createdBy || null };
                        }
                        const ownerUserId = course.createdBy || await resolveTutorOwnerUserId(course.tutorId);
                        return { isPersonalAsset: true, instituteId: null, tutorId: course.tutorId || null, ownerUserId };
                    }
                }
            }
        }

        if (reqTutorId && mongoose.Types.ObjectId.isValid(reqTutorId)) {
            const ownerUserId = await resolveTutorOwnerUserId(reqTutorId);
            return { isPersonalAsset: true, instituteId: null, tutorId: reqTutorId, ownerUserId };
        }
    } catch (err) {
        console.error('Error resolving asset context:', err);
    }

    return null;
};

/**
 * Determines whether the current request bills an Institute pool or a Tutor's Private pool.
 * Strictly blocks cross-workspace billing and ensures Students never pay for AI credits.
 */
const resolveBillingContext = async (req, assetContext) => {
    const explicitWorkspaceHeader = (req.headers['x-workspace-type'] || req.query?.workspaceType || '')
        .toString()
        .trim()
        .toLowerCase();

    if (req.workspace?.type === 'private_tutor' && assetContext && !assetContext.isPersonalAsset && assetContext.instituteId) {
        return {
            errorStatus: 403,
            errorPayload: {
                success: false,
                code: 'WORKSPACE_ISOLATION_VIOLATION',
                message: 'Access denied. Switch to your Institute workspace to use AI on institute assets.',
            },
        };
    }

    if (explicitWorkspaceHeader === 'institute' && assetContext?.isPersonalAsset) {
        return {
            errorStatus: 403,
            errorPayload: {
                success: false,
                code: 'WORKSPACE_ISOLATION_VIOLATION',
                message: 'Access denied. Switch to your Private Tuition workspace to use AI on private assets.',
            },
        };
    }

    const isInstituteContext = req.workspace?.type === 'private_tutor'
        ? false
        : assetContext
            ? !assetContext.isPersonalAsset
            : (req.workspace?.type === 'institute' ? true : !!req.tenant);

    if (isInstituteContext) {
        return {
            mode: 'institute',
            targetInstituteId: assetContext?.instituteId || req.tenant?._id || req.user?.instituteId || null,
        };
    }

    let billingOwnerUserId = assetContext?.ownerUserId || null;

    if (!billingOwnerUserId && assetContext?.tutorId) {
        billingOwnerUserId = await resolveTutorOwnerUserId(assetContext.tutorId);
    }
    if (!billingOwnerUserId && req.workspace?.tutorUserId) {
        billingOwnerUserId = req.workspace.tutorUserId;
    }
    if (!billingOwnerUserId && req.user?.role === 'tutor') {
        billingOwnerUserId = req.user._id || req.user.id;
    }
    if (!billingOwnerUserId && req.user?.role === 'student') {
        const activeTutorUserIds = req.workspace?.activeTutorUserIds || [];
        if (activeTutorUserIds.length === 1) {
            billingOwnerUserId = activeTutorUserIds[0];
        } else if (activeTutorUserIds.length > 1) {
            return {
                errorStatus: 400,
                errorPayload: {
                    success: false,
                    code: 'TUTOR_CONTEXT_REQUIRED',
                    message: 'Please select a Private Tutor workspace (X-Tutor-Id or course) to use AI tools.',
                },
            };
        } else {
            return {
                errorStatus: 403,
                errorPayload: {
                    success: false,
                    code: 'PORTAL_APPROVAL_REQUIRED',
                    message: 'No approved Private Tutor found for AI usage.',
                },
            };
        }
    }

    if (!billingOwnerUserId) {
        return {
            errorStatus: 403,
            errorPayload: {
                success: false,
                code: 'PERSONAL_SUBSCRIPTION_REQUIRED',
                message: 'Could not determine an owning Tutor subscription for Private Tuition AI usage.',
            },
        };
    }

    if (req.user?.role === 'student' && assetContext?.tutorId) {
        const activeTutorIds = (req.workspace?.activeTutorIds || []).map(String);
        if (!activeTutorIds.includes(String(assetContext.tutorId))) {
            const linked = await TutorStudentLink.exists({
                studentId: req.user._id || req.user.id,
                tutorId: assetContext.tutorId,
                status: 'active',
            });
            if (!linked) {
                return {
                    errorStatus: 403,
                    errorPayload: {
                        success: false,
                        code: 'TUTOR_NOT_LINKED',
                        message: 'Access denied. You do not have an approved link with this Private Tutor.',
                    },
                };
            }
        }
    }

    return {
        mode: 'private_tutor',
        billingOwnerUserId,
        isStudentUsingTutorPool: req.user?.role === 'student' && String(billingOwnerUserId) !== String(req.user?._id || req.user?.id),
    };
};

const verifyInstituteMembershipForBilling = (req, targetInstituteId) => {
    if (!targetInstituteId) return true;
    const allowedIds = req.workspace?.membershipInstituteIds?.length
        ? req.workspace.membershipInstituteIds.map(String)
        : [String(req.tenant?._id || req.user?.instituteId || '')].filter(Boolean);
    return allowedIds.includes(String(targetInstituteId));
};

/**
 * Shared Institute quota check for tutors and students (deduplicated across legacy + membership records).
 */
export const checkInstituteQuota = async (institute, resourceType) => {
    const features = institute?.features || {};

    if (resourceType === 'tutors') {
        if (!features.manageTutors) {
            return { allowed: false, status: 403, message: 'Plan does not permit tutor management. Upgrade is required.' };
        }
        const maxTutors = features.maxTutors !== undefined ? features.maxTutors : 5;
        if (maxTutors !== -1) {
            const [memTutorIds, legacyTutorUserIds] = await Promise.all([
                InstituteMembership.distinct('userId', { instituteId: institute._id, roleInInstitute: 'tutor', status: 'active' }),
                Tutor.distinct('userId', { instituteId: institute._id }),
            ]);
            const tutorCount = new Set([...memTutorIds, ...legacyTutorUserIds].map(String)).size;
            if (tutorCount >= maxTutors) {
                return {
                    allowed: false,
                    status: 403,
                    message: `Tutor limit exceeded. Your plan allows maximum ${maxTutors} tutors.`,
                    currentCount: tutorCount,
                    maxAllowed: maxTutors,
                    upgradeRequired: true,
                };
            }
            return { allowed: true, currentCount: tutorCount, maxAllowed: maxTutors };
        }
        return { allowed: true, currentCount: 0, maxAllowed: -1 };
    }

    if (resourceType === 'students') {
        if (!features.manageStudents) {
            return { allowed: false, status: 403, message: 'Plan does not permit student management. Upgrade is required.' };
        }
        const maxStudents = features.maxStudents !== undefined ? features.maxStudents : 50;
        if (maxStudents !== -1) {
            const [memStudentIds, legacyStudentIds] = await Promise.all([
                InstituteMembership.distinct('userId', { instituteId: institute._id, roleInInstitute: 'student', status: 'active' }),
                User.distinct('_id', { instituteId: institute._id, role: 'student' }),
            ]);
            const studentCount = new Set([...memStudentIds, ...legacyStudentIds].map(String)).size;
            if (studentCount >= maxStudents) {
                return {
                    allowed: false,
                    status: 403,
                    message: `Student limit exceeded. Your plan allows maximum ${maxStudents} students.`,
                    currentCount: studentCount,
                    maxAllowed: maxStudents,
                    upgradeRequired: true,
                };
            }
            return { allowed: true, currentCount: studentCount, maxAllowed: maxStudents };
        }
        return { allowed: true, currentCount: 0, maxAllowed: -1 };
    }

    return { allowed: true };
};

export const checkPrivateStudentQuota = async (tutorUserId) => {
    const user = await User.findById(tutorUserId).select('personalSubscription').lean();
    const defaults = getTutorFreeSubscriptionConfig().features;
    const subFeatures = user?.personalSubscription?.features || {};
    const maxPrivateStudents = subFeatures.maxPrivateStudents !== undefined
        ? subFeatures.maxPrivateStudents
        : defaults.maxPrivateStudents;

    if (maxPrivateStudents === -1) {
        return { allowed: true, currentCount: 0, maxAllowed: -1 };
    }
    const currentCount = await TutorStudentLink.countDocuments({ tutorUserId, status: 'active' });
    return {
        allowed: currentCount < maxPrivateStudents,
        currentCount,
        maxAllowed: maxPrivateStudents,
    };
};

export const checkPrivateCourseQuota = async (tutorId, tutorUserId) => {
    const user = await User.findById(tutorUserId).select('personalSubscription').lean();
    const defaults = getTutorFreeSubscriptionConfig().features;
    const subFeatures = user?.personalSubscription?.features || {};
    const maxPrivateCourses = subFeatures.maxPrivateCourses !== undefined
        ? subFeatures.maxPrivateCourses
        : defaults.maxPrivateCourses;

    if (maxPrivateCourses === -1) {
        return { allowed: true, currentCount: 0, maxAllowed: -1 };
    }
    const currentCount = await Course.countDocuments({ tutorId, instituteId: null });
    return {
        allowed: currentCount < maxPrivateCourses,
        currentCount,
        maxAllowed: maxPrivateCourses,
    };
};

/**
 * Ensures the active workspace (Institute or Private Tutor Studio) has the specified feature enabled.
 */
export const requireFeature = (featureKey) => {
    return async (req, res, next) => {
        try {
            // Superadmins and Students enjoy free, unblocked access (subscriptions are only for Institutes and Tutors)
            if (req.user && (req.user.role === 'superadmin' || req.user.role === 'student')) {
                return next();
            }

            const assetContext = await resolveAssetContext(req);
            const billing = await resolveBillingContext(req, assetContext);

            if (billing.errorStatus) {
                return res.status(billing.errorStatus).json(billing.errorPayload);
            }

            if (billing.mode === 'institute') {
                if (!req.tenant) {
                    return res.status(403).json({
                        success: false,
                        message: 'Institute context missing. Cannot verify subscription features.',
                    });
                }

                if (!verifyInstituteMembershipForBilling(req, assetContext?.instituteId)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access Denied. You do not belong to the owner institute of this asset.',
                    });
                }

                const features = req.tenant.features || {};
                if (!hasFeatureEnabled(features, featureKey)) {
                    return res.status(403).json({
                        success: false,
                        featureLocked: true,
                        requiredFeature: featureKey,
                        message: `Feature '${featureKey}' is not included in the institute subscription plan. Upgrade to access this feature.`,
                    });
                }
            } else {
                const ownerUser = await User.findById(billing.billingOwnerUserId).select('personalSubscription').lean();
                const sub = ownerUser?.personalSubscription;

                if (!sub || !sub.isActive || !sub.features) {
                    return res.status(403).json({
                        success: false,
                        featureLocked: true,
                        personalLocked: true,
                        requiredFeature: featureKey,
                        message: billing.isStudentUsingTutorPool
                            ? 'Your Private Tutor does not have this feature enabled on their Private Studio plan.'
                            : 'Active Tutor subscription plan is required to access this Private Studio feature.',
                    });
                }

                if (!hasFeatureEnabled(sub.features, featureKey)) {
                    return res.status(403).json({
                        success: false,
                        featureLocked: true,
                        personalLocked: true,
                        requiredFeature: featureKey,
                        message: billing.isStudentUsingTutorPool
                            ? 'Your Private Tutor does not have this AI feature enabled on their current Private Studio tier.'
                            : 'Feature is not available in your current Private Studio tier. Upgrade your Tutor plan.',
                    });
                }
            }

            return next();
        } catch (error) {
            console.error('requireFeature middleware error:', error);
            return res.status(500).json({ success: false, message: 'Feature verification failed.' });
        }
    };
};

/**
 * Checks if creating/approving a new resource would exceed the Institute's plan limits.
 */
export const requireLimit = (resourceType) => {
    return async (req, res, next) => {
        try {
            if (req.user && req.user.role === 'superadmin') {
                return next();
            }

            // Creating a standalone Tutor profile inside Private Studio is not bounded by Institute caps
            if (resourceType === 'tutors' && req.workspace?.type === 'private_tutor' && req.user?.role === 'tutor') {
                return next();
            }

            const institute = req.tenant;
            if (!institute) {
                return res.status(403).json({
                    success: false,
                    message: 'Institute context required',
                });
            }

            const quota = await checkInstituteQuota(institute, resourceType);
            if (!quota.allowed) {
                return res.status(quota.status || 403).json({
                    success: false,
                    message: quota.message,
                    currentCount: quota.currentCount,
                    maxAllowed: quota.maxAllowed,
                    upgradeRequired: Boolean(quota.upgradeRequired),
                });
            }

            return next();
        } catch (error) {
            console.error('Feature limit check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Feature connection verification failed',
            });
        }
    };
};

/**
 * Enforces Private Studio caps (`students` or `courses`) from Tutor's Free/Pro personalSubscription.
 */
export const requirePrivateLimit = (resourceType) => {
    return async (req, res, next) => {
        try {
            if (req.user && req.user.role === 'superadmin') {
                return next();
            }

            const tutorUserId = req.user?._id || req.user?.id;
            if (!tutorUserId || req.user?.role !== 'tutor') {
                return res.status(403).json({ success: false, message: 'Tutor access required' });
            }

            if (resourceType === 'students') {
                const quota = await checkPrivateStudentQuota(tutorUserId);
                if (!quota.allowed) {
                    return res.status(403).json({
                        success: false,
                        upgradeRequired: true,
                        currentCount: quota.currentCount,
                        maxAllowed: quota.maxAllowed,
                        message: `Private student limit reached (${quota.currentCount}/${quota.maxAllowed}). Upgrade your Tutor plan to onboard more private students.`,
                    });
                }
                return next();
            }

            if (resourceType === 'courses') {
                const tutor = await Tutor.findOne({ userId: tutorUserId }).select('_id').lean();
                if (!tutor) {
                    return res.status(404).json({ success: false, message: 'Tutor profile not found' });
                }
                const quota = await checkPrivateCourseQuota(tutor._id, tutorUserId);
                if (!quota.allowed) {
                    return res.status(403).json({
                        success: false,
                        upgradeRequired: true,
                        currentCount: quota.currentCount,
                        maxAllowed: quota.maxAllowed,
                        message: `Private course limit reached (${quota.currentCount}/${quota.maxAllowed}). Upgrade your Tutor plan to create more private courses.`,
                    });
                }
                return next();
            }

            return next();
        } catch (error) {
            console.error('Private limit check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Private quota verification failed',
            });
        }
    };
};

/**
 * Atomically deducts AI credits from either the Institute pool or the owning Tutor's Private pool.
 */
export const consumeAICredits = (cost = 1) => {
    return async (req, res, next) => {
        try {
            // Students use all AI tools completely free without subscription paywalls or credit caps!
            // Subscriptions are strictly for Institutes and Tutors hosting on the platform.
            if (req.user && (req.user.role === 'superadmin' || req.user.role === 'student')) {
                return next();
            }

            const assetContext = await resolveAssetContext(req);
            const billing = await resolveBillingContext(req, assetContext);

            if (billing.errorStatus) {
                return res.status(billing.errorStatus).json(billing.errorPayload);
            }

            if (billing.mode === 'institute') {
                if (!req.tenant) {
                    return res.status(403).json({
                        success: false,
                        message: 'Institute context missing for AI usage.',
                    });
                }

                const targetInstituteId = billing.targetInstituteId;
                if (!verifyInstituteMembershipForBilling(req, targetInstituteId)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access Denied. You do not belong to the owner institute of this asset.',
                    });
                }

                const instituteDoc = String(req.tenant._id) === String(targetInstituteId)
                    ? req.tenant
                    : await Institute.findById(targetInstituteId).select('features aiUsageCount').lean();

                const limit = instituteDoc?.features?.aiCreditsPerMonth || 0;

                const updatedInstitute = await Institute.findOneAndUpdate(
                    {
                        _id: targetInstituteId,
                        $expr: { $lte: [{ $add: [{ $ifNull: ['$aiUsageCount', 0] }, cost] }, limit] },
                    },
                    { $inc: { aiUsageCount: cost } },
                    { new: true }
                );

                if (!updatedInstitute) {
                    const currentInstitute = await Institute.findById(targetInstituteId).select('aiUsageCount').lean();
                    const remaining = Math.max(0, limit - (currentInstitute?.aiUsageCount || 0));
                    return res.status(403).json({
                        success: false,
                        featureLocked: true,
                        creditExhausted: true,
                        message: `AI credits exhausted. Action requires ${cost} credits, but only ${remaining} are available. Contact the administrator to upgrade.`,
                    });
                }

                if (req.tenant && String(req.tenant._id) === String(targetInstituteId)) {
                    req.tenant.aiUsageCount = updatedInstitute.aiUsageCount;
                }

                req.billingContext = 'institute';
            } else {
                const ownerUser = await User.findById(billing.billingOwnerUserId).select('personalSubscription').lean();
                const sub = ownerUser?.personalSubscription;

                if (!sub || !sub.isActive || !hasFeatureEnabled(sub.features, 'aiFeatures')) {
                    return res.status(403).json({
                        success: false,
                        featureLocked: true,
                        personalLocked: true,
                        code: 'PERSONAL_SUBSCRIPTION_REQUIRED',
                        message: billing.isStudentUsingTutorPool
                            ? 'Your Private Tutor does not have AI features enabled on their Private Studio plan.'
                            : 'Tutor Private Studio AI subscription is required to access AI features.',
                    });
                }

                const personalLimit = sub.features.aiCreditsPerMonth || 0;

                const updatedUser = await User.findOneAndUpdate(
                    {
                        _id: billing.billingOwnerUserId,
                        'personalSubscription.isActive': true,
                        $expr: {
                            $lte: [
                                { $add: [{ $ifNull: ['$personalSubscription.features.aiUsageCount', 0] }, cost] },
                                personalLimit,
                            ],
                        },
                    },
                    { $inc: { 'personalSubscription.features.aiUsageCount': cost } },
                    { new: true }
                );

                if (!updatedUser) {
                    const remaining = Math.max(0, personalLimit - (sub.features.aiUsageCount || 0));
                    return res.status(403).json({
                        success: false,
                        featureLocked: true,
                        creditExhausted: true,
                        message: billing.isStudentUsingTutorPool
                            ? `Your Private Tutor's AI credits are exhausted (${remaining} remaining). Ask your tutor to upgrade their plan.`
                            : `Private Studio AI credits exhausted. Action requires ${cost} credits, but only ${remaining} are available. Upgrade your Tutor plan.`,
                    });
                }

                req.billingContext = 'private_tutor';
                req.billingOwnerUserId = billing.billingOwnerUserId;
            }

            return next();
        } catch (error) {
            console.error('AI Credit consumption error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to process AI request. Try again later.',
            });
        }
    };
};
