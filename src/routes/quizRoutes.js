import express from 'express';
import {
  startQuizAttempt,
  submitQuizAttempt,
  getQuizAttempts,
  getAttemptDetails,
} from '../controllers/quizController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/start/:lessonId', protect, startQuizAttempt);
router.post('/submit/:lessonId', protect, submitQuizAttempt);
router.get('/attempts/:lessonId', protect, getQuizAttempts);
router.get('/attempt/:attemptId', protect, getAttemptDetails);

export default router;