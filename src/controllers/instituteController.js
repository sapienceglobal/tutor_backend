import Institute from '../models/Institute.js';

// @desc    Get current institute settings (Admin)
// @route   GET /api/institutes/me
export const getCurrentInstitute = async (req, res) => {
    try {
        if (!req.tenant) {
            return res.status(404).json({ success: false, message: 'No tenant found in context' });
        }

        const institute = await Institute.findById(req.tenant._id);

        res.status(200).json({
            success: true,
            institute
        });
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

        // Only allow updating visual/operational settings
        const { logo, brandColors, contactEmail } = req.body;

        const updateData = {};
        if (logo !== undefined) updateData.logo = logo;
        if (brandColors !== undefined) updateData.brandColors = brandColors;
        if (contactEmail !== undefined) updateData.contactEmail = contactEmail;

        const institute = await Institute.findByIdAndUpdate(
            req.tenant._id,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Institute settings updated successfully',
            institute
        });
    } catch (error) {
        console.error('Update institute error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

/**
 * Update institute subscription plan (Super Admin only)
 */
export const updateInstitutePlan = async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'superadmin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Only superadmins can update subscription plans' 
            });
        }

        const { instituteId, plan, maxTutors, maxStudents } = req.body;

        const institute = await Institute.findById(instituteId);
        if (!institute) {
            return res.status(404).json({ 
                success: false, 
                message: 'Institute not found' 
            });
        }

        // Update subscription plan and limits
        const updateData = { subscriptionPlan: plan };
        if (maxTutors !== undefined) updateData.maxTutors = maxTutors;
        if (maxStudents !== undefined) updateData.maxStudents = maxStudents;

        const updatedInstitute = await Institute.findByIdAndUpdate(
            instituteId,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: `Institute plan updated to ${plan} successfully`,
            institute: updatedInstitute
        });
    } catch (error) {
        console.error('Update institute plan error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update institute plan' 
        });
    }
};
