import Institute from '../models/Institute.js';

export const resolveTenant = async (req, res, next) => {
    try {
        // Superadmins bypass tenant isolation by default unless testing
        if (req.user && req.user.role === 'superadmin') {
            req.tenant = null;
            return next();
        }

        // Users MUST have an assigned instituteId to use the platform (except SuperAdmins)
        if (req.user && req.user.instituteId) {
            const tenant = await Institute.findById(req.user.instituteId);
            if (!tenant) {
                return res.status(403).json({ success: false, message: 'Tenant context invalid or Institute not found.' });
            }
            if (!tenant.isActive) {
                return res.status(403).json({ success: false, message: 'This Institute account has been suspended or deactivated.' });
            }
            req.tenant = tenant;
            return next();
        }

        // If for some reason a user is authenticated without an instituteId but isn't superadmin 
        if (req.user) {
            return res.status(403).json({ success: false, message: 'User is not assigned to any specific Institute.' });
        }

        // Unauthenticated routes (like /api/auth/login or public course catalog)
        // They might resolve Tenant by Subdomain or custom header
        const host = req.get('host');
        const subdomain = host.split('.')[0];

        let tenant = await Institute.findOne({ subdomain: subdomain, isActive: true });

        // Fallback to default if subdomain doesn't match and we are locally testing
        if (!tenant) {
            tenant = await Institute.findOne({ subdomain: 'default' });
        }

        req.tenant = tenant; // Might be null if NO default exists
        next();

    } catch (error) {
        console.error('Tenant Resolution Error:', error);
        res.status(500).json({ success: false, message: 'Server Error resolving tenant context.' });
    }
};

/**
 * Middleware to restrict access based on the tenant's active features
 * @param {string} featureKey - The feature key from Institute.features (e.g. 'hlsStreaming', 'aiFeatures')
 */
export const requireFeature = (featureKey) => {
    return (req, res, next) => {
        // Superadmins have access to everything to test things
        if (req.user && req.user.role === 'superadmin') {
            return next();
        }

        if (!req.tenant) {
            return res.status(403).json({ success: false, message: 'Invalid tenant context. Cannot verify feature access.' });
        }

        const features = req.tenant.features || {};
        if (!features[featureKey]) {
            return res.status(403).json({
                success: false,
                message: `Upgrade Required: Your institute's current subscription plan does not include access to '${featureKey}'.`
            });
        }

        next();
    };
};
