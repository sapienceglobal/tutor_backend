import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 
import { getGlobalAttendance } from '../controllers/superadminAttendanceController.js';

const router = express.Router();

// Strict protection: Only superadmin
router.use(protect);
router.use(authorize('superadmin')); 

// Read-only route for global attendance overview
router.get('/', getGlobalAttendance);

export default router;