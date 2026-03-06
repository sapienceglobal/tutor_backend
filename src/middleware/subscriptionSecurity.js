import jwt from 'jsonwebtoken';
import Institute from '../models/Institute.js';

/**
 * Security middleware to prevent frontend subscription manipulation
 * Ensures subscription data comes from database, not frontend
 */
export const secureSubscriptionCheck = (req, res, next) => {
    try {
        // Get user from auth middleware
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Get institute from database (not from frontend)
        const institute = req.tenant;
        if (!institute) {
            return res.status(403).json({
                success: false,
                message: 'Institute context required'
            });
        }

        // Add secure subscription data to request
        req.secureSubscription = {
            plan: institute.subscriptionPlan,
            features: institute.features,
            expiresAt: institute.subscriptionExpiresAt,
            isActive: institute.isActive,
            // Add checksum for verification
            checksum: generateSubscriptionChecksum(institute)
        };

        next();
    } catch (error) {
        console.error('Subscription security check error:', error);
        res.status(500).json({
            success: false,
            message: 'Security validation failed'
        });
    }
};

/**
 * Generate checksum for subscription data verification
 */
const generateSubscriptionChecksum = (institute) => {
    const data = `${institute._id}-${institute.subscriptionPlan}-${JSON.stringify(institute.features)}-${institute.isActive}`;
    return require('crypto')
        .createHash('sha256')
        .update(data + process.env.SUBSCRIPTION_SECRET_KEY)
        .digest('hex');
};

/**
 * Verify subscription data integrity
 */
export const verifySubscriptionIntegrity = (req, res, next) => {
    try {
        const providedChecksum = req.headers['x-subscription-checksum'];
        const secureSubscription = req.secureSubscription;

        if (!providedChecksum || !secureSubscription) {
            return res.status(403).json({
                success: false,
                message: 'Subscription verification required'
            });
        }

        // Recalculate checksum and verify
        const expectedChecksum = secureSubscription.checksum;
        if (providedChecksum !== expectedChecksum) {
            console.error('Subscription tampering detected:', {
                provided: providedChecksum,
                expected: expectedChecksum,
                userId: req.user.id,
                ip: req.ip
            });

            return res.status(403).json({
                success: false,
                message: 'Subscription data integrity verification failed'
            });
        }

        next();
    } catch (error) {
        console.error('Subscription integrity verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Security verification failed'
        });
    }
};

/**
 * Enhanced feature check with security validation
 */
export const secureFeatureCheck = (featureKey) => {
    return (req, res, next) => {
        try {
            // Superadmins have access to everything for testing
            if (req.user && req.user.role === 'superadmin') {
                return next();
            }

            // Use secure subscription data (not from frontend)
            const secureSubscription = req.secureSubscription;
            if (!secureSubscription) {
                return res.status(403).json({
                    success: false,
                    message: 'Secure subscription context required'
                });
            }

            // Check if institute is active
            if (!secureSubscription.isActive) {
                return res.status(403).json({
                    success: false,
                    message: 'Institute account is suspended'
                });
            }

            // Check if subscription has expired
            if (secureSubscription.expiresAt && new Date() > secureSubscription.expiresAt) {
                return res.status(403).json({
                    success: false,
                    message: 'Subscription has expired. Please renew your plan.'
                });
            }

            // Check feature access
            const features = secureSubscription.features || {};
            if (!features[featureKey]) {
                // Log security violation attempt
                console.warn('Unauthorized feature access attempt:', {
                    userId: req.user.id,
                    featureKey,
                    plan: secureSubscription.plan,
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    timestamp: new Date().toISOString()
                });

                return res.status(403).json({
                    success: false,
                    message: `Feature '${featureKey}' is not available in your ${secureSubscription.plan} plan. Upgrade to access this feature.`
                });
            }

            // Add security headers
            res.setHeader('X-Feature-Access-Granted', featureKey);
            res.setHeader('X-Subscription-Plan', secureSubscription.plan);
            res.setHeader('X-Access-Timestamp', new Date().toISOString());

            next();
        } catch (error) {
            console.error('Secure feature check error:', error);
            res.status(500).json({
                success: false,
                message: 'Feature access verification failed'
            });
        }
    };
};

/**
 * Middleware to detect frontend manipulation
 */
export const detectFrontendManipulation = (req, res, next) => {
    try {
        // Check for suspicious headers or data
        const suspiciousPatterns = [
            /x\-modifed/i,
            /x\-tampered/i,
            /x\-hacked/i
        ];

        const userAgent = req.headers['user-agent'] || '';
        const referer = req.headers.referer || '';

        // Check for browser developer tools manipulation
        if (userAgent.includes('Chrome') && referer.includes('localhost')) {
            // Log potential manipulation attempt
            console.warn('Potential frontend manipulation detected:', {
                userId: req.user?.id,
                ip: req.ip,
                userAgent,
                referer,
                timestamp: new Date().toISOString()
            });
        }

        // Validate request body structure
        if (req.body && typeof req.body === 'object') {
            const forbiddenKeys = ['subscription', 'features', 'plan'];
            const hasForbiddenKeys = forbiddenKeys.some(key => key in req.body);

            if (hasForbiddenKeys && req.user?.role !== 'superadmin') {
                return res.status(403).json({
                    success: false,
                    message: 'Direct subscription modification is not allowed'
                });
            }
        }

        next();
    } catch (error) {
        console.error('Frontend manipulation detection error:', error);
        next();
    }
};
