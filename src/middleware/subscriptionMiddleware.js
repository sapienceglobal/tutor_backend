import Institute from '../models/Institute.js';
import Tutor from '../models/Tutor.js';
import User from '../models/User.js';

/**
 * Plan-based feature access middleware
 * Enforces subscription limits and feature access based on institute's plan
 */

const PLAN_LIMITS = {
    free: {
        maxTutors: 2,
        maxStudents: 10,
        features: {
            manageTutors: true,
            manageStudents: true,
            hlsStreaming: false,
            customBranding: false,
            zoomIntegration: false,
            aiFeatures: false,
            customDomain: false,
            advancedAnalytics: false,
            apiAccess: false
        }
    },
    basic: {
        maxTutors: 10,
        maxStudents: 100,
        features: {
            manageTutors: true,
            manageStudents: true,
            hlsStreaming: true,
            customBranding: true,
            zoomIntegration: true,
            aiFeatures: true,
            customDomain: false,
            advancedAnalytics: false,
            apiAccess: true
        }
    },
    pro: {
        maxTutors: 50,
        maxStudents: 500,
        features: {
            manageTutors: true,
            manageStudents: true,
            hlsStreaming: true,
            customBranding: true,
            zoomIntegration: true,
            aiFeatures: true,
            customDomain: true,
            advancedAnalytics: true,
            apiAccess: true
        }
    },
    enterprise: {
        maxTutors: -1, // unlimited
        maxStudents: -1, // unlimited
        features: {
            manageTutors: true,
            manageStudents: true,
            hlsStreaming: true,
            customBranding: true,
            zoomIntegration: true,
            aiFeatures: true,
            customDomain: true,
            advancedAnalytics: true,
            apiAccess: true
        }
    }
};

/**
 * Check if a feature is available in the current plan
 */
export const checkFeatureAccess = (featureKey) => {
    return async (req, res, next) => {
        try {
            // Superadmins have access to everything
            if (req.user && req.user.role === 'superadmin') {
                return next();
            }

            // Get institute from tenant context
            const institute = req.tenant;
            if (!institute) {
                return res.status(403).json({
                    success: false,
                    message: 'Institute context required'
                });
            }

            // Check if institute is active
            if (!institute.isActive) {
                return res.status(403).json({
                    success: false,
                    message: 'Institute account is suspended'
                });
            }

            // Check if subscription has expired
            if (institute.subscriptionExpiresAt && new Date() > institute.subscriptionExpiresAt) {
                return res.status(403).json({
                    success: false,
                    message: 'Subscription has expired. Please renew your plan.'
                });
            }

            const plan = institute.subscriptionPlan || 'free';
            const planLimits = PLAN_LIMITS[plan];
            const features = institute.features || {};

            // Check feature access
            if (!planLimits.features[featureKey]) {
                return res.status(403).json({
                    success: false,
                    message: `Feature '${featureKey}' is not available in your ${plan} plan. Upgrade to access this feature.`,
                    currentPlan: plan,
                    requiredPlan: Object.keys(PLAN_LIMITS).find(p => PLAN_LIMITS[p].features[featureKey])
                });
            }

            // Check specific limits for resources
            if (featureKey === 'manageTutors') {
                const tutorCount = await Tutor.countDocuments({
                    'instituteId': institute._id 
                });
                
                if (planLimits.maxTutors > 0 && tutorCount >= planLimits.maxTutors) {
                    return res.status(403).json({
                        success: false,
                        message: `Tutor limit exceeded. Your ${plan} plan allows maximum ${planLimits.maxTutors} tutors.`,
                        currentCount: tutorCount,
                        maxAllowed: planLimits.maxTutors,
                        upgradeRequired: true
                    });
                }
            }

            if (featureKey === 'manageStudents') {
                const studentCount = await User.countDocuments({
                    'instituteId': institute._id,
                    'role': 'student'
                });
                
                if (planLimits.maxStudents > 0 && studentCount >= planLimits.maxStudents) {
                    return res.status(403).json({
                        success: false,
                        message: `Student limit exceeded. Your ${plan} plan allows maximum ${planLimits.maxStudents} students.`,
                        currentCount: studentCount,
                        maxAllowed: planLimits.maxStudents,
                        upgradeRequired: true
                    });
                }
            }

            // Add feature access headers
            res.setHeader('X-Feature-Access-Granted', featureKey);
            res.setHeader('X-Subscription-Plan', plan);
            res.setHeader('X-Access-Timestamp', new Date().toISOString());

            next();
        } catch (error) {
            console.error('Feature access check error:', error);
            res.status(500).json({
                success: false,
                message: 'Feature access verification failed'
            });
        }
    };
};

/**
 * Get plan limits for a specific plan
 */
export const getPlanLimits = (plan) => {
    return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
};

/**
 * Check if institute can upgrade to a specific plan
 */
export const canUpgradeTo = (currentPlan, targetPlan) => {
    const planHierarchy = ['free', 'basic', 'pro', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    const targetIndex = planHierarchy.indexOf(targetPlan);
    
    return targetIndex > currentIndex;
};

/**
 * Get available upgrade options
 */
export const getUpgradeOptions = (currentPlan) => {
    const planHierarchy = ['free', 'basic', 'pro', 'enterprise'];
    const currentIndex = planHierarchy.indexOf(currentPlan);
    
    return planHierarchy.slice(currentIndex + 1).map(plan => ({
        name: plan,
        limits: PLAN_LIMITS[plan],
        canUpgrade: true
    }));
};
