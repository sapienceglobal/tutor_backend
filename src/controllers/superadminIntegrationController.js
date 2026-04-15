import ZoomConfig from '../models/ZoomConfig.js';

// @desc    Get Global Zoom Config (For Superadmin)
// @route   GET /api/superadmin/integrations/zoom
// @access  Private/Superadmin
export const getZoomConfig = async (req, res) => {
    try {
        // Find global config (where instituteId is null/exists is false based on sparse index)
        let zoom = await ZoomConfig.findOne({ instituteId: null });
        
        // Auto-create blank document if it doesn't exist yet
        if (!zoom) {
            zoom = await ZoomConfig.create({ instituteId: null });
        }

        res.status(200).json({
            success: true,
            data: {
                accountId: zoom.accountId,
                clientId: zoom.clientId,
                isEnabled: zoom.isEnabled,
                // We never send the actual secret back! Just a boolean if it exists.
                hasSecret: !!zoom.clientSecret && zoom.clientSecret !== ''
            }
        });
    } catch (error) {
        console.error('Fetch Zoom Config Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch Zoom config' });
    }
};

// @desc    Update Global Zoom Config
// @route   PUT /api/superadmin/integrations/zoom
// @access  Private/Superadmin
export const updateZoomConfig = async (req, res) => {
    try {
        const { accountId, clientId, clientSecret, isEnabled } = req.body;
        
        let zoom = await ZoomConfig.findOne({ instituteId: null });
        if (!zoom) {
            zoom = new ZoomConfig({ instituteId: null });
        }

        if (accountId !== undefined) zoom.accountId = accountId;
        if (clientId !== undefined) zoom.clientId = clientId;
        if (isEnabled !== undefined) zoom.isEnabled = isEnabled;
        
        // Only update secret if user actually typed a new one
        if (clientSecret && clientSecret.trim() !== '') {
            zoom.clientSecret = clientSecret; 
            // 🌟 Magic happens here: Your schema's pre('save') hook will encrypt this instantly!
        }

        await zoom.save();

        res.status(200).json({
            success: true,
            message: 'Zoom configuration secured and saved successfully!'
        });
    } catch (error) {
        console.error('Update Zoom Config Error:', error);
        res.status(500).json({ success: false, message: 'Failed to save Zoom config' });
    }
};