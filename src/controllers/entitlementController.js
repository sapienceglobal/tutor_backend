import { getForUser } from '../services/entitlementService.js';

// @desc    Get resolved access entitlements for current user
// @route   GET /api/entitlements/me
// @access  Private
export const getMyEntitlements = async (req, res) => {
    try {
        const entitlements = await getForUser(req.user, req.user?.instituteId);
        if (!entitlements) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        return res.status(200).json({
            success: true,
            entitlements,
        });
    } catch (error) {
        console.error('Get entitlements error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to resolve entitlements',
        });
    }
};
