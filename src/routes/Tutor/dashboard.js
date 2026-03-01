import express from 'express';
import {
  getTutorStats,
  getRecentActivities,
  getEarningsOverview,
  getTutorStudents,
  getStudentPerformance,
  blockStudent,
  unblockStudent
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
router.post('/students/:studentId/block', blockStudent);
router.post('/students/:studentId/unblock', unblockStudent);

export default router;