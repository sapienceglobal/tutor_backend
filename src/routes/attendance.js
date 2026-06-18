import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { markAttendanceSchema, getBatchAttendanceSchema } from '../validations/attendanceValidation.js';
import {
    markAttendance,
    getBatchAttendance
} from '../controllers/attendanceController.js';

const router = express.Router();

router.use(protect);

// Mark attendance (Tutor only)
router.post('/batch', authorize('tutor'), validate(markAttendanceSchema), markAttendance);

// Get attendance for a batch (Student, Tutor, Admin)
router.get('/batch/:batchId', validate(getBatchAttendanceSchema), getBatchAttendance);

export default router;
