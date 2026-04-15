import Institute from '../models/Institute.js';
import Tutor from '../models/Tutor.js';
import User from '../models/User.js';

/**
 * Ensures the tenant has the specified feature enabled in their subscription.
 * Unifies previous feature checks into one definitive function based on the database settings.
 */
export const requireFeature = (featureKey) => {
    return (req, res, next) => {
        // Superadmins bypass feature locks
        if (req.user && req.user.role === 'superadmin') {
            return next();
        }

        if (!req.tenant) {
             return res.status(403).json({
                success: false,
                message: 'Institute context missing. Cannot verify subscription features.'
            });
        }

        // Feature is missing or false -> Block access
        const features = req.tenant.features || {};
        if (!features[featureKey]) {
            return res.status(403).json({
                success: false,
                featureLocked: true,
                requiredFeature: featureKey,
                message: `This feature '${featureKey}' is not available in your current subscription plan. Please upgrade to access it.`
            });
        }

        next();
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
