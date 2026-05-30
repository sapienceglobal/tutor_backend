import mongoose from 'mongoose';
import Institute from '../models/Institute.js';
import Tutor from '../models/Tutor.js';
import User from '../models/User.js';

/**
 * Helper: Dynamic Context Resolver
 * Resolves the context of the asset (Course, Exam, Batch, Lesson, etc.)
 * Returns:
 * - { isPersonalAsset: false, instituteId: ObjectId } -> Connected to an Institute
 * - { isPersonalAsset: true, instituteId: null } -> Explicitly personal/global asset
 * - null -> General action (no specific asset context in request)
 */
const resolveAssetContext = async (req) => {
    const { courseId, examId, lessonId, batchId, lectureId, chatSessionId, sessionId } = {
        ...(req.body || {}),
        ...(req.query || {}),
        ...(req.params || {})
    };

    // If no asset indicators are present in the request, return null (general action)
    if (!courseId && !examId && !lessonId && !batchId && !lectureId && !chatSessionId && !sessionId && !req.body?.instituteId && !req.query?.instituteId) {
        return null;
    }

    try {
        // 1. Direct instituteId in request
        if (req.body?.instituteId || req.query?.instituteId) {
            const instId = req.body?.instituteId || req.query?.instituteId;
            return { isPersonalAsset: false, instituteId: instId };
        }

        // 2. Resolve from Course
        if (courseId) {
            const Course = mongoose.model('Course');
            const course = await Course.findById(courseId).select('instituteId');
            if (course) {
                return course.instituteId 
                    ? { isPersonalAsset: false, instituteId: course.instituteId }
                    : { isPersonalAsset: true, instituteId: null };
            }
        }

        // 3. Resolve from Exam
        if (examId) {
            const Exam = mongoose.model('Exam');
            const exam = await Exam.findById(examId).select('instituteId');
            if (exam) {
                return exam.instituteId 
                    ? { isPersonalAsset: false, instituteId: exam.instituteId }
                    : { isPersonalAsset: true, instituteId: null };
            }
        }

        // 4. Resolve from Batch
        if (batchId) {
            const Batch = mongoose.model('Batch');
            const batch = await Batch.findById(batchId).select('instituteId');
            if (batch) {
                return batch.instituteId 
                    ? { isPersonalAsset: false, instituteId: batch.instituteId }
                    : { isPersonalAsset: true, instituteId: null };
            }
        }

        // 5. Resolve from Lesson (lessons belong to courses)
        if (lessonId) {
            const Lesson = mongoose.model('Lesson');
            const lesson = await Lesson.findById(lessonId).select('courseId');
            if (lesson && lesson.courseId) {
                const Course = mongoose.model('Course');
                const course = await Course.findById(lesson.courseId).select('instituteId');
                if (course) {
                    return course.instituteId 
                        ? { isPersonalAsset: false, instituteId: course.instituteId }
                        : { isPersonalAsset: true, instituteId: null };
                }
            }
        }

        // 6. Resolve from Lecture Summary
        if (lectureId) {
            const LectureSummary = mongoose.model('LectureSummary');
            const lecture = await LectureSummary.findById(lectureId).select('instituteId');
            if (lecture) {
                return lecture.instituteId 
                    ? { isPersonalAsset: false, instituteId: lecture.instituteId }
                    : { isPersonalAsset: true, instituteId: null };
            }
        }

        // 7. Resolve from AI Chat Session
        const sessId = chatSessionId || sessionId || req.params.id;
        if (sessId && mongoose.Types.ObjectId.isValid(sessId)) {
            const AIChatSession = mongoose.model('AIChatSession');
            const session = await AIChatSession.findById(sessId).select('instituteId courseId');
            if (session) {
                if (session.instituteId) {
                    return { isPersonalAsset: false, instituteId: session.instituteId };
                }
                if (session.courseId) {
                    const Course = mongoose.model('Course');
                    const course = await Course.findById(session.courseId).select('instituteId');
                    if (course) {
                        return course.instituteId 
                            ? { isPersonalAsset: false, instituteId: course.instituteId }
                            : { isPersonalAsset: true, instituteId: null };
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error resolving asset context:', err);
    }

    return null;
};

/**
 * Ensures the tenant (or personal plan) has the specified feature enabled.
 * Dynamically switches context between Institute features and Personal features.
 */
export const requireFeature = (featureKey) => {
    return async (req, res, next) => {
        try {
            // Superadmins bypass feature locks
            if (req.user && req.user.role === 'superadmin') {
                return next();
            }

            // Resolve context of the target asset
            const assetContext = await resolveAssetContext(req);

            // Determine if we should bill/enforce Institute or Personal
            const isInstituteContext = assetContext 
                ? !assetContext.isPersonalAsset 
                : !!req.user.instituteId; // Default to Institute if user belongs to one and action is general

            if (isInstituteContext) {
                // --- INSTITUTE CONTEXT ACTION ---
                if (!req.tenant) {
                    return res.status(403).json({
                        success: false,
                        message: 'Institute context missing. Cannot verify subscription features.'
                    });
                }

                // Security check if asset context is present
                if (assetContext && assetContext.instituteId && String(req.user.instituteId) !== String(assetContext.instituteId)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access Denied. You do not belong to the owner institute of this asset.'
                    });
                }

                const features = req.tenant.features || {};
                if (!features[featureKey]) {
                    return res.status(403).json({
                        success: false,
                        featureLocked: true,
                        requiredFeature: featureKey,
                        message: `This feature '${featureKey}' is not available in your institute's subscription plan. Please upgrade to access it.`
                    });
                }
            } else {
                // --- PERSONAL / GLOBAL CONTEXT ACTION ---
                const user = await User.findById(req.user.id);
                const sub = user.personalSubscription;

                if (!sub || !sub.isActive || !sub.features || !sub.features[featureKey]) {
                    return res.status(403).json({
                        success: false,
                        featureLocked: true,
                        personalLocked: true,
                        requiredFeature: featureKey,
                        message: `This is a personal/global asset. To use this AI feature, please purchase a Personal AI Plan.`
                    });
                }
            }

            next();
        } catch (error) {
            console.error('requireFeature middleware error:', error);
            res.status(500).json({ success: false, message: 'Feature verification failed.' });
        }
    };
};

/**
 * Checks if creating a new resource would exceed the Institute's plan limits.
 * Uses limits directly stored in the Institute model feature configurations.
 */
export const requireLimit = (resourceType) => {
    return async (req, res, next) => {
        try {
            // Superadmins bypass limits
            if (req.user && req.user.role === 'superadmin') {
                return next();
            }

            const institute = req.tenant;
            if (!institute) {
                return res.status(403).json({
                    success: false,
                    message: 'Institute context required'
                });
            }

            const features = institute.features || {};

            if (resourceType === 'tutors') {
                if (!features.manageTutors) {
                    return res.status(403).json({ success: false, message: 'Your plan does not allow managing tutors. Please upgrade.' });
                }
                const maxTutors = features.maxTutors !== undefined ? features.maxTutors : 5; 
                if (maxTutors !== -1) {
                    const tutorCount = await Tutor.countDocuments({ instituteId: institute._id });
                    if (tutorCount >= maxTutors) {
                        return res.status(403).json({
                            success: false,
                            message: `Tutor limit exceeded. Your plan allows maximum ${maxTutors} tutors.`,
                            currentCount: tutorCount,
                            maxAllowed: maxTutors,
                            upgradeRequired: true
                        });
                    }
                }
            }

            if (resourceType === 'students') {
                 if (!features.manageStudents) {
                    return res.status(403).json({ success: false, message: 'Your plan does not allow managing students. Please upgrade.' });
                }
                const maxStudents = features.maxStudents !== undefined ? features.maxStudents : 50;
                if (maxStudents !== -1) {
                    const studentCount = await User.countDocuments({
                        instituteId: institute._id,
                        role: 'student'
                    });
                    if (studentCount >= maxStudents) {
                        return res.status(403).json({
                            success: false,
                            message: `Student limit exceeded. Your plan allows maximum ${maxStudents} students.`,
                            currentCount: studentCount,
                            maxAllowed: maxStudents,
                            upgradeRequired: true
                        });
                    }
                }
            }

            next();
        } catch (error) {
            console.error('Feature limit check error:', error);
            res.status(500).json({
                success: false,
                message: 'Feature connection verification failed'
            });
        }
    };
};

/**
 * 🌟 Consumes AI Credits for a tenant OR a personal user plan.
 * Dynamically switches credit consumption context based on asset ownership.
 */
export const consumeAICredits = (cost = 1) => {
    return async (req, res, next) => {
        try {
            // Superadmins bypass credits
            if (req.user && req.user.role === 'superadmin') {
                return next();
            }

            // Resolve context of the target asset
            const assetContext = await resolveAssetContext(req);

            // Determine if we should bill Institute or Personal
            const isInstituteContext = assetContext 
                ? !assetContext.isPersonalAsset 
                : !!req.user.instituteId; // Default to Institute if user belongs to one and action is general

            if (isInstituteContext) {
                // --- DEDUCT FROM INSTITUTE QUOTA ---
                if (!req.tenant) {
                    return res.status(403).json({
                        success: false,
                        message: 'Institute context missing for AI usage.'
                    });
                }

                // Security check: Does user belong to this institute?
                const targetInstituteId = assetContext?.instituteId || req.user.instituteId;
                if (String(req.user.instituteId) !== String(targetInstituteId)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Access Denied. You do not belong to the owner institute of this asset.'
                    });
                }

                const limit = req.tenant.features?.aiCreditsPerMonth || 0;
                const usage = req.tenant.aiUsageCount || 0;
                const remaining = Math.max(0, limit - usage);

                if (remaining < cost) {
                    return res.status(403).json({
                        success: false,
                        featureLocked: true,
                        creditExhausted: true,
                        message: `AI Credits exhausted! This action requires ${cost} credits, but your institute only has ${remaining} left. Please ask your Admin to upgrade.`
                    });
                }

                // Deduct credits by incrementing usage atomically
                await Institute.findByIdAndUpdate(
                    targetInstituteId,
                    { $inc: { aiUsageCount: cost } }
                );

                // Update loaded memory context
                if (req.tenant) {
                    req.tenant.aiUsageCount = usage + cost;
                }
                
                req.billingContext = 'institute';
            } else {
                // --- DEDUCT FROM USER PERSONAL QUOTA ---
                const user = await User.findById(req.user.id);
                const sub = user.personalSubscription;

                if (!sub || !sub.isActive || !sub.features || !sub.features.aiFeatures) {
                    return res.status(403).json({
                        success: false,
                        featureLocked: true,
                        personalLocked: true,
                        code: "PERSONAL_SUBSCRIPTION_REQUIRED",
                        message: "This is a personal/global asset. To use AI here, please purchase a Personal AI Subscription."
                    });
                }

                const personalCredits = sub.features.aiCreditsPerMonth - sub.features.aiUsageCount;

                if (personalCredits < cost) {
                    return res.status(403).json({
                        success: false,
                        featureLocked: true,
                        creditExhausted: true,
                        message: `Your Personal AI Credits are exhausted! This action requires ${cost} credits, but you only have ${personalCredits} left. Please upgrade your personal plan.`
                    });
                }

                // Deduct credits from user document
                await User.findByIdAndUpdate(
                    req.user.id,
                    { $inc: { 'personalSubscription.features.aiUsageCount': cost } }
                );

                req.billingContext = 'personal';
            }

            next();
        } catch (error) {
            console.error('AI Credit consumption error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to process AI request. Please try again.'
            });
        }
    };
};
