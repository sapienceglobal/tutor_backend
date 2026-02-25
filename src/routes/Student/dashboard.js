import express from 'express';
import {
    getStudentActivity,
    getStudentStats
} from '../../controllers/Student/dashboardController.js';
import { protect, authorize } from '../../middleware/auth.js';

const router = express.Router();

// All routes are protected and restricted to students only
router.use(protect, authorize('student'));

router.get('/activity', getStudentActivity);
router.get('/stats', getStudentStats);

export default router;
