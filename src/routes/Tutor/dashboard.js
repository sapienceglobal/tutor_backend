import express from 'express';
import {
  getTutorStats,
  getRecentActivities,
  getEarningsOverview,
  getTutorStudents,
  getStudentPerformance
} from '../../controllers/Tutor/dashboardController.js';
import { protect, authorize } from '../../middleware/auth.js';

const router = express.Router();

// All routes are protected and restricted to tutors only
router.use(protect, authorize('tutor'));

router.get('/stats', getTutorStats);
router.get('/activities', getRecentActivities);
router.get('/earnings', getEarningsOverview);
router.get('/students', getTutorStudents);
router.get('/performance', getStudentPerformance);

export default router;