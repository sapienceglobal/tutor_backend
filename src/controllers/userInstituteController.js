import User from '../models/User.js';
import Institute from '../models/Institute.js';

// ─── Fields to populate when returning institute to frontend ─────────────────
const INSTITUTE_POPULATE_FIELDS = [
    'name', 'subdomain', 'logo', 'contactEmail',
    'brandColors',          // legacy
    'studentTheme',         // NEW
    'tutorTheme',           // NEW
    'themeSettings',        // NEW
    'subscriptionPlan', 'features',
    'subscriptionExpiresAt', 'aiUsageQuota', 'aiUsageCount',
].join(' ');

/**
 * GET /api/user-institute/me
 * Returns the institute of the currently logged-in user (any role)
 * ThemeContext uses this to get institute-level student/tutor themes
 */
export const getUserInstitute = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const user = await User.findById(req.user.id)
            .populate('instituteId', INSTITUTE_POPULATE_FIELDS);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.status(200).json({
            success: true,
            institute: user.instituteId || null,
            role: user.role,
        });

    } catch (error) {
        console.error('Get user institute error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * PUT /api/user-institute/me
 * Institute admin updates their own institute branding + themes
 * Accepts: name, contactEmail, logo, brandColors,
 *          studentTheme, tutorTheme, themeSettings,
 *          allowGlobalPublishingByInstituteTutors
 */
export const updateUserInstitute = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const user = await User.findById(req.user.id);
        if (!user || !user.instituteId) {
            return res.status(404).json({ success: false, message: 'Institute not found' });
        }

        const {
            name,
            contactEmail,
            logo,
            brandColors,            // legacy — still accepted
            studentTheme,           // NEW
            tutorTheme,             // NEW
            themeSettings,          // NEW — { useGlobalTheme, fontFamily, fontSize }
            allowGlobalPublishingByInstituteTutors,
        } = req.body;

        const updateData = {};

        // ── Basic fields ──────────────────────────────────────────────────────
        if (name)         updateData.name         = name;
        if (contactEmail) updateData.contactEmail = contactEmail;
        if (logo)         updateData.logo         = logo;

        // ── Legacy brandColors (backward compat) ──────────────────────────────
        if (brandColors && typeof brandColors === 'object') {
            updateData.brandColors = {
                primary:   brandColors.primary   || undefined,
                secondary: brandColors.secondary || undefined,
                accent:    brandColors.accent    || undefined,
                sidebar:   brandColors.sidebar   || undefined,
            };
        }

        // ── NEW: Role-specific themes ─────────────────────────────────────────
        if (studentTheme && typeof studentTheme === 'object') {
            updateData.studentTheme = {
                primaryColor:   studentTheme.primaryColor,
                secondaryColor: studentTheme.secondaryColor,
                accentColor:    studentTheme.accentColor,
                sidebarColor:   studentTheme.sidebarColor,
                fontFamily:     studentTheme.fontFamily,
                fontSize:       studentTheme.fontSize,
            };
        }

        if (tutorTheme && typeof tutorTheme === 'object') {
            updateData.tutorTheme = {
                primaryColor:   tutorTheme.primaryColor,
                secondaryColor: tutorTheme.secondaryColor,
                accentColor:    tutorTheme.accentColor,
                sidebarColor:   tutorTheme.sidebarColor,
                fontFamily:     tutorTheme.fontFamily,
                fontSize:       tutorTheme.fontSize,
            };
        }

        // ── NEW: themeSettings (useGlobalTheme toggle etc.) ───────────────────
        if (themeSettings && typeof themeSettings === 'object') {
            // Use dot-notation updates so we don't overwrite sibling fields
            if (typeof themeSettings.useGlobalTheme === 'boolean') {
                updateData['themeSettings.useGlobalTheme'] = themeSettings.useGlobalTheme;
            }
            if (themeSettings.fontFamily) {
                updateData['themeSettings.fontFamily'] = themeSettings.fontFamily;
            }
            if (themeSettings.fontSize) {
                updateData['themeSettings.fontSize'] = themeSettings.fontSize;
            }
        }

        // ── Feature flag ──────────────────────────────────────────────────────
        if (typeof allowGlobalPublishingByInstituteTutors === 'boolean') {
            updateData['features.allowGlobalPublishingByInstituteTutors'] = allowGlobalPublishingByInstituteTutors;
        }

        const institute = await Institute.findByIdAndUpdate(
            user.instituteId,
            { $set: updateData },
            { returnDocument: 'after', runValidators: true }
        );

        if (!institute) {
            return res.status(404).json({ success: false, message: 'Institute not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Institute updated successfully',
            institute,
        });

    } catch (error) {
        console.error('Update user institute error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};