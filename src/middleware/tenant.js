import Institute from '../models/Institute.js';

export const resolveTenant = async (req, res, next) => {
    try {
        // Explicit Private Tuition workspace never uses an Institute tenant
        if (req.workspace?.type === 'private_tutor') {
            req.tenant = null;
            return next();
        }

        // Users waiting for approval have no active workspace yet
        if (req.user && req.workspace?.type === 'none') {
            return res.status(403).json({
                success: false,
                code: 'PORTAL_APPROVAL_REQUIRED',
                portalApprovalRequired: true,
                message: 'Your join request is awaiting approval from an Institute or Private Tutor.',
            });
        }

        // Reuse already resolved tenant context from protect / attachWorkspaceContext if available
        if (req.tenant) {
            if (!req.tenant.isActive) {
                return res.status(403).json({ success: false, message: 'This Institute account has been suspended or deactivated.' });
            }
            return next();
        }

        // Superadmins bypass tenant isolation by default unless testing
        if (req.user && req.user.role === 'superadmin') {
            req.tenant = null;
            return next();
        }

        // Users in institute workspace MUST have an assigned instituteId
        const targetInstituteId = req.workspace?.instituteId || req.user?.instituteId;
        if (req.user && targetInstituteId) {
            const tenant = await Institute.findById(targetInstituteId);
            if (!tenant) {
                return res.status(403).json({ success: false, message: 'Tenant context invalid or Institute not found.' });
            }
            if (!tenant.isActive) {
                return res.status(403).json({ success: false, message: 'This Institute account has been suspended or deactivated.' });
            }
            req.tenant = tenant;
            return next();
        }

        // Authenticated user without active institute or private tutor workspace
        if (req.user) {
            return res.status(403).json({
                success: false,
                code: 'PORTAL_APPROVAL_REQUIRED',
                portalApprovalRequired: true,
                message: 'You do not have an active institute workspace yet.',
            });
        }

        // Unauthenticated routes (like /api/auth/login or public subdomain lookup)
        const host = req.get('host') || '';
        const subdomain = host.split('.')[0];

        let tenant = subdomain ? await Institute.findOne({ subdomain: subdomain, isActive: true }) : null;

        if (!tenant) {
            tenant = await Institute.findOne({ subdomain: 'default' });
        }

        req.tenant = tenant;
        next();

    } catch (error) {
        console.error('Tenant Resolution Error:', error);
        res.status(500).json({ success: false, message: 'Server Error resolving tenant context.' });
    }
};


