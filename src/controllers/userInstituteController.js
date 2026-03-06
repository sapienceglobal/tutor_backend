import User from '../models/User.js';
import Institute from '../models/Institute.js';

/**
 * Get user's institute information (works for all user types)
 */
export const getUserInstitute = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Get user with institute info
        const user = await User.findById(req.user.id)
            .populate('instituteId', 'name subdomain logo brandColors subscriptionPlan features subscriptionExpiresAt aiUsageQuota aiUsageCount');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // If user has institute, return institute info
        if (user.instituteId) {
            const response = {
                success: true,
                institute: user.instituteId,
                role: user.role
            };
            return res.status(200).json(response);
        }

        // No institute assigned
        return res.status(200).json({
            success: true,
            institute: null,
            role: user.role
        });

    } catch (error) {
        console.error('Get user institute error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Update user's institute information (admin only)
 */
export const updateUserInstitute = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Only admins can update institute info
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const { name, contactEmail, logo, brandColors, allowGlobalPublishingByInstituteTutors } = req.body;

        // Get user with institute info
        const user = await User.findById(req.user.id);

        if (!user || !user.instituteId) {
            return res.status(404).json({
                success: false,
                message: 'Institute not found'
            });
        }

        // Update institute
        const updateData = {};
        if (name) updateData.name = name;
        if (contactEmail) updateData.contactEmail = contactEmail;
        if (logo) updateData.logo = logo;
        if (brandColors) updateData.brandColors = brandColors;
        if (typeof allowGlobalPublishingByInstituteTutors === 'boolean') {
            updateData['features.allowGlobalPublishingByInstituteTutors'] = allowGlobalPublishingByInstituteTutors;
        }

        const institute = await Institute.findByIdAndUpdate(
            user.instituteId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!institute) {
            return res.status(404).json({
                success: false,
                message: 'Institute not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Institute updated successfully',
            institute
        });

    } catch (error) {
        console.error('Update user institute error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
