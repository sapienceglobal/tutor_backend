import express from 'express';
import { resolveTenant } from '../middleware/tenant.js';

const router = express.Router();

router.use(resolveTenant);

// @desc    Get public tenant configuration for frontend branding
// @route   GET /api/tenant/config
router.get('/config', (req, res) => {
    if (!req.tenant) {
        // Return default Sapience Global config
        return res.status(200).json({
            success: true,
            tenant: {
                name: 'Sapience Global',
                logo: '',
                brandColors: { primary: '#4f46e5', secondary: '#f8fafc' },
                features: {
                    maxStudents: 100,
                    hlsStreaming: true,
                    customBranding: true,
                    zoomIntegration: true,
                    aiFeatures: true
                }
            }
        });
    }

    res.status(200).json({
        success: true,
        tenant: {
            name: req.tenant.name,
            logo: req.tenant.logo,
            brandColors: req.tenant.brandColors,
            features: req.tenant.features
        }
    });
});

export default router;
