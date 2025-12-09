import express from 'express';
import {
  getTutorStats,
  getRecentActivities,
  getEarningsOverview,
  getTutorStudents
} from '../../controllers/Tutor/dashboardController.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/stats', getTutorStats);
router.get('/activities', getRecentActivities);
router.get('/earnings', getEarningsOverview);
router.get('/students', getTutorStudents);

export default router;