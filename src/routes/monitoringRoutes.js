import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 
import { getMonitoringOverview } from '../controllers/monitoringController.js';

const router = express.Router();

// STRICTLY PROTECTED FOR SUPERADMIN ONLY
router.use(protect);
router.use(authorize('superadmin')); 

router.get('/overview', getMonitoringOverview);

export default router;