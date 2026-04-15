import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 
import { getZoomConfig, updateZoomConfig } from '../controllers/superadminIntegrationController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('superadmin')); 

// Zoom Integration Routes
router.get('/zoom', getZoomConfig);

router.put('/zoom', updateZoomConfig);

export default router;