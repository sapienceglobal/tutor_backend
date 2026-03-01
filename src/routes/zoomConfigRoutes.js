import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { getZoomConfig, updateZoomConfig } from '../controllers/zoomConfigController.js';

const router = express.Router();

router.route('/')
    .get(protect, authorize('admin', 'superadmin'), getZoomConfig)
    .put(protect, authorize('admin', 'superadmin'), updateZoomConfig);

export default router;
