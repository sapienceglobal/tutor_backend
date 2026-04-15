import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 
import { getGlobalReports, updateReportStatus } from '../controllers/superadminReportController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('superadmin')); 

// Read-only dashboard route
router.get('/', getGlobalReports);
 
router.patch('/:id/status', updateReportStatus);

export default router;