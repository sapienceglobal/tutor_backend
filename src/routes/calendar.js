import express from 'express';
import { protect } from '../middleware/auth.js';
import { getUpcomingExams } from '../controllers/calendarController.js';

const router = express.Router();

router.use(protect);

// Get upcoming exams for calendar widget
router.get('/upcoming-exams', getUpcomingExams);

export default router;
