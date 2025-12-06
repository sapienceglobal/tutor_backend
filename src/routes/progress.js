import express from 'express';
import {
  updateProgress,
  getCourseProgress,
  getLessonProgress,
} from '../controllers/progressController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/', updateProgress);
router.get('/course/:courseId', getCourseProgress);
router.get('/lesson/:lessonId', getLessonProgress);

export default router;