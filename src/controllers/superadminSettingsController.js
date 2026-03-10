import Settings from '../models/Settings.js';
import Institute from '../models/Institute.js';

// ─── Helper: build full settings response ────────────────────────────────────
const buildSettingsResponse = (settings) => ({
    // Basic
    siteName:           settings.siteName       || 'Sapience LMS',
    supportEmail:       settings.supportEmail   || '',
    defaultLanguage:    settings.defaultLanguage || 'English',
    footerText:         settings.footerText      || '',
    contactEmail:       settings.contactEmail    || '',
    contactAddress:     settings.contactAddress  || '',
    supportPhone:       settings.supportPhone    || '',
    // Social
    facebookLink:   settings.facebookLink  || '',
    twitterLink:    settings.twitterLink   || '',
    instagramLink:  settings.instagramLink || '',
    linkedinLink:   settings.linkedinLink  || '',
    youtubeLink:    settings.youtubeLink   || '',
    // SEO
    favicon:           settings.favicon           || '',
    googleAnalyticsId: settings.googleAnalyticsId || '',
    metaPixelId:       settings.metaPixelId       || '',
    // Platform controls
    maintenanceMode:    settings.maintenanceMode    || false,
    allowRegistration:  settings.allowRegistration  !== false,
    autoApproveCourses: settings.autoApproveCourses || false,
    autoApproveTutors:  settings.autoApproveTutors  || false,
    allowGuestBrowsing: settings.allowGuestBrowsing !== false,
    platformCommission: settings.platformCommission || 10,
    // Theme mode & permissions
    enableDarkMode:         settings.enableDarkMode         !== false,
    allowInstituteBranding: settings.allowInstituteBranding !== false,
    enforceGlobalTheme:     settings.enforceGlobalTheme     || false,
    // ── NEW: Role-specific theme objects ──
    globalTheme:  settings.globalTheme  || null,
    studentTheme: settings.studentTheme || null,
    tutorTheme:   settings.tutorTheme   || null,
    // Legacy flat fields (backward compat)
    primaryColor:   settings.primaryColor   || '#4338ca',
    secondaryColor: settings.secondaryColor || '#f8fafc',
    accentColor:    settings.accentColor    || '#6366f1',
    fontFamily:     settings.fontFamily     || "'DM Sans', sans-serif",
    fontSize:       settings.fontSize       || 14,
});

// ─── GET /api/superadmin/settings ───────────────────────────────────────────
// @access  Private (Superadmin)
export const getGlobalSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});

        res.status(200).json({
            success: true,
            settings: buildSettingsResponse(settings),
        });
    } catch (error) {
        console.error('Get global settings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── PUT /api/superadmin/settings ───────────────────────────────────────────
// @access  Private (Superadmin)
export const updateGlobalSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) settings = await Settings.create({});

        const {
            // Basic fields
            siteName, supportEmail, defaultLanguage, footerText,
            contactEmail, contactAddress, supportPhone,
            // Social
            facebookLink, twitterLink, instagramLink, linkedinLink, youtubeLink,
            // SEO
            favicon, googleAnalyticsId, metaPixelId,
            // Platform controls
            maintenanceMode, allowRegistration, autoApproveCourses,
            autoApproveTutors, allowGuestBrowsing, platformCommission,
            // Theme mode & permissions
            enableDarkMode, allowInstituteBranding, enforceGlobalTheme,
            // ── NEW: Role-specific themes ──
            globalTheme, studentTheme, tutorTheme,
        } = req.body;

        // ── Flat basic fields ─────────────────────────────────────────────────
        const flatFields = {
            siteName, supportEmail, defaultLanguage, footerText,
            contactEmail, contactAddress, supportPhone,
            facebookLink, twitterLink, instagramLink, linkedinLink, youtubeLink,
            favicon, googleAnalyticsId, metaPixelId,
            maintenanceMode, allowRegistration, autoApproveCourses,
            autoApproveTutors, allowGuestBrowsing, platformCommission,
            enableDarkMode, allowInstituteBranding, enforceGlobalTheme,
        };
        Object.entries(flatFields).forEach(([key, val]) => {
            if (val !== undefined) settings[key] = val;
        });

        // ── Role-specific theme objects ───────────────────────────────────────
        if (globalTheme && typeof globalTheme === 'object') {
            settings.globalTheme = {
                primaryColor:   globalTheme.primaryColor   || settings.globalTheme?.primaryColor,
                secondaryColor: globalTheme.secondaryColor || settings.globalTheme?.secondaryColor,
                accentColor:    globalTheme.accentColor    || settings.globalTheme?.accentColor,
                sidebarColor:   globalTheme.sidebarColor   || settings.globalTheme?.sidebarColor,
                fontFamily:     globalTheme.fontFamily     || settings.globalTheme?.fontFamily,
                fontSize:       globalTheme.fontSize       || settings.globalTheme?.fontSize,
            };
            // ── markModified: Mongoose won't detect nested object reassignment without this ──
            settings.markModified('globalTheme');
            // Keep legacy flat fields in sync with globalTheme
            settings.primaryColor   = settings.globalTheme.primaryColor;
            settings.secondaryColor = settings.globalTheme.secondaryColor;
            settings.accentColor    = settings.globalTheme.accentColor;
            settings.fontFamily     = settings.globalTheme.fontFamily;
            settings.fontSize       = settings.globalTheme.fontSize;
        }

        if (studentTheme && typeof studentTheme === 'object') {
            settings.studentTheme = {
                primaryColor:   studentTheme.primaryColor   || settings.studentTheme?.primaryColor,
                secondaryColor: studentTheme.secondaryColor || settings.studentTheme?.secondaryColor,
                accentColor:    studentTheme.accentColor    || settings.studentTheme?.accentColor,
                sidebarColor:   studentTheme.sidebarColor   || settings.studentTheme?.sidebarColor,
                fontFamily:     studentTheme.fontFamily     || settings.studentTheme?.fontFamily,
                fontSize:       studentTheme.fontSize       || settings.studentTheme?.fontSize,
            };
            // ── markModified: required for Mongoose to persist subdocument changes ──
            settings.markModified('studentTheme');
        }

        if (tutorTheme && typeof tutorTheme === 'object') {
            settings.tutorTheme = {
                primaryColor:   tutorTheme.primaryColor   || settings.tutorTheme?.primaryColor,
                secondaryColor: tutorTheme.secondaryColor || settings.tutorTheme?.secondaryColor,
                accentColor:    tutorTheme.accentColor    || settings.tutorTheme?.accentColor,
                sidebarColor:   tutorTheme.sidebarColor   || settings.tutorTheme?.sidebarColor,
                fontFamily:     tutorTheme.fontFamily     || settings.tutorTheme?.fontFamily,
                fontSize:       tutorTheme.fontSize       || settings.tutorTheme?.fontSize,
            };
            // ── markModified: required for Mongoose to persist subdocument changes ──
            settings.markModified('tutorTheme');
        }

        settings.updatedAt = Date.now();
        await settings.save();

        // ── If enforceGlobalTheme is ON → clear all institute customizations ──
        if (enforceGlobalTheme === true) {
            await Institute.updateMany(
                {},
                { $set: { 'themeSettings.useGlobalTheme': true } }
            );
        }

        res.status(200).json({
            success: true,
            message: 'Global settings updated successfully',
            settings: buildSettingsResponse(settings),
        });
    } catch (error) {
        console.error('Update global settings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─── GET /api/superadmin/global-theme ────────────────────────────────────────
// @desc   Institute admins call this to get SuperAdmin's theme (read-only)
// @access Private (Admin, Tutor, Student — any authenticated user)
export const getGlobalTheme = async (req, res) => {
    try {
        const settings = await Settings.findOne().lean();
        if (!settings) {
            return res.status(200).json({ success: true, theme: null });
        }

        res.status(200).json({
            success: true,
            theme: {
                globalTheme:  settings.globalTheme  || null,
                studentTheme: settings.studentTheme || null,
                tutorTheme:   settings.tutorTheme   || null,
                allowInstituteBranding: settings.allowInstituteBranding !== false,
                enforceGlobalTheme:     settings.enforceGlobalTheme     || false,
                enableDarkMode:         settings.enableDarkMode         !== false,
            },
        });
    } catch (error) {
        console.error('Get global theme error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};