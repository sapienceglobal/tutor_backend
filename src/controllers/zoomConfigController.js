import ZoomConfig from '../models/ZoomConfig.js';

// @desc    Get Zoom config for current institute
// @route   GET /api/admin/zoom-config
// @access  Private (Admin)
export const getZoomConfig = async (req, res) => {
    try {
        const filter = req.tenant ? { instituteId: req.tenant._id } : { instituteId: null };
        let config = await ZoomConfig.findOne(filter);

        if (!config) {
            config = { clientId: '', clientSecret: '', accountId: '', isEnabled: false, usageLogs: [] };
        } else {
            // Mask the secret for frontend display
            config = config.toObject();
            if (config.clientSecret) {
                config.clientSecret = '••••••••••••••••';
                config.hasSecret = true;
            }
        }

        res.status(200).json({ success: true, config });
    } catch (error) {
        console.error('Get Zoom config error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update Zoom config for current institute
// @route   PUT /api/admin/zoom-config
// @access  Private (Admin)
export const updateZoomConfig = async (req, res) => {
    try {
        const { clientId, clientSecret, accountId, isEnabled } = req.body;
        const filter = req.tenant ? { instituteId: req.tenant._id } : { instituteId: null };

        let config = await ZoomConfig.findOne(filter);

        if (!config) {
            config = new ZoomConfig({
                ...filter,
                clientId,
                clientSecret,
                accountId,
                isEnabled: isEnabled || false,
            });
        } else {
            if (clientId !== undefined) config.clientId = clientId;
            // Only update secret if a new one is provided (not the masked value)
            if (clientSecret && clientSecret !== '••••••••••••••••') {
                config.clientSecret = clientSecret;
            }
            if (accountId !== undefined) config.accountId = accountId;
            if (isEnabled !== undefined) config.isEnabled = isEnabled;
        }

        await config.save();

        // Mask secret in response
        const response = config.toObject();
        if (response.clientSecret) {
            response.clientSecret = '••••••••••••••••';
            response.hasSecret = true;
        }

        res.status(200).json({
            success: true,
            message: 'Zoom configuration updated successfully',
            config: response,
        });
    } catch (error) {
        console.error('Update Zoom config error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
