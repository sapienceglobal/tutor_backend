import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    markAttendance,
    getBatchAttendance
} from '../controllers/attendanceController.js';

const router = express.Router();

router.use(protect);

// Mark attendance (Tutor only)
router.post('/batch', authorize('tutor'), markAttendance);

// Get attendance for a batch (Student, Tutor, Admin)
router.get('/batch/:batchId', getBatchAttendance);

export default router;
