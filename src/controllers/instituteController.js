import Institute from '../models/Institute.js';

// @desc    Get current institute settings (Admin)
// @route   GET /api/institutes/me
export const getCurrentInstitute = async (req, res) => {
    try {
        if (!req.tenant) {
            return res.status(404).json({ success: false, message: 'No tenant found in context' });
        }

        const institute = await Institute.findById(req.tenant._id);

        res.status(200).json({ success: true, institute });
    } catch (error) {
        console.error('Get institute error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update current institute branding & settings (Admin)
// @route   PUT /api/institutes/me
export const updateInstituteBranding = async (req, res) => {
    try {
        if (!req.tenant) {
            return res.status(404).json({ success: false, message: 'No tenant found in context' });
        }

        const {
            logo,
            contactEmail,
            brandColors,        // legacy — still accepted
            studentTheme,       // NEW: role-specific theme for students
            tutorTheme,         // NEW: role-specific theme for tutors
            themeSettings,      // NEW: { useGlobalTheme, fontFamily, fontSize }
        } = req.body;

        const updateData = {};

        // ── Basic fields ──────────────────────────────────────────────────────
        if (logo         !== undefined) updateData.logo         = logo;
        if (contactEmail !== undefined) updateData.contactEmail = contactEmail;

        // ── Legacy brandColors ────────────────────────────────────────────────
        if (brandColors  !== undefined) updateData.brandColors  = brandColors;

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

        // ── NEW: themeSettings (useGlobalTheme toggle) ────────────────────────
        if (themeSettings && typeof themeSettings === 'object') {
            if (typeof themeSettings.useGlobalTheme === 'boolean') {
                updateData['themeSettings.useGlobalTheme'] = themeSettings.useGlobalTheme;
            }
            if (themeSettings.fontFamily) updateData['themeSettings.fontFamily'] = themeSettings.fontFamily;
            if (themeSettings.fontSize)   updateData['themeSettings.fontSize']   = themeSettings.fontSize;
        }

        const institute = await Institute.findByIdAndUpdate(
            req.tenant._id,
            { $set: updateData },
            { returnDocument: 'after', runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Institute settings updated successfully',
            institute,
        });
    } catch (error) {
        console.error('Update institute error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update institute subscription plan (Super Admin only)
// @route   PUT /api/institutes/plan
export const updateInstitutePlan = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'superadmin') {
            return res.status(403).json({ success: false, message: 'Only superadmins can update subscription plans' });
        }

        const { instituteId, plan, maxTutors, maxStudents } = req.body;

        const institute = await Institute.findById(instituteId);
        if (!institute) {
            return res.status(404).json({ success: false, message: 'Institute not found' });
        }

        // Dynamically import SubscriptionPlan to retrieve its feature mapping
        const SubscriptionPlan = (await import('../models/SubscriptionPlan.js')).default;
        const selectedPlan = await SubscriptionPlan.findOne({ name: { $regex: new RegExp(`^${plan}$`, 'i') } });

        const updateData = { subscriptionPlan: plan };
        if (selectedPlan) {
            updateData.features = {
                ...selectedPlan.features.toObject(),
                manageTutors: true,
                manageStudents: true,
                maxTutors: maxTutors !== undefined ? Number(maxTutors) : selectedPlan.features.maxTutors,
                maxStudents: maxStudents !== undefined ? Number(maxStudents) : selectedPlan.features.maxStudents,
                aiFeatures: selectedPlan.features.aiAssistant || selectedPlan.features.aiAssessment || selectedPlan.features.aiIntelligence || false
            };
            if (selectedPlan.features.aiCreditsPerMonth !== undefined) {
                updateData.aiUsageQuota = selectedPlan.features.aiCreditsPerMonth;
            }
        } else {
            if (maxTutors  !== undefined) updateData['features.maxTutors']  = Number(maxTutors);
            if (maxStudents !== undefined) updateData['features.maxStudents'] = Number(maxStudents);
        }

        const updatedInstitute = await Institute.findByIdAndUpdate(
            instituteId,
            { $set: updateData },
            { returnDocument: 'after', runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: `Institute plan updated to ${plan} successfully`,
            institute: updatedInstitute,
        });
    } catch (error) {
        console.error('Update institute plan error:', error);
        res.status(500).json({ success: false, message: 'Failed to update institute plan' });
    }
};