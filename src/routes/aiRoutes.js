import express from 'express';
import { generateQuestions, generateLessonQuiz } from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/generate-questions', protect, generateQuestions);
router.post('/generate-lesson-quiz', protect, generateLessonQuiz);

export default router;