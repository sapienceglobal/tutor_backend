import express from 'express';
import {
    getStudentActivity,
    getStudentStats
} from '../../controllers/Student/dashboardController.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/activity', getStudentActivity);
router.get('/stats', getStudentStats);

export default router;
