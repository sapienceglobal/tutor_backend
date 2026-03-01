import express from 'express';
import {
    generateQuestions,
    generateLessonQuiz,
    chatWithTutor,
    generateStudentAnalytics,
    summarizeLesson,
    generateRevisionNotes,
    getAIUsageStats,
} from '../controllers/aiController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.post('/generate-questions', protect, generateQuestions);
router.post('/generate-lesson-quiz', protect, generateLessonQuiz);
router.post('/tutor-chat', protect, chatWithTutor);
router.get('/analytics/student', protect, generateStudentAnalytics);
router.post('/summarize-lesson', protect, summarizeLesson);
router.post('/revision-notes', protect, generateRevisionNotes);
router.get('/usage-stats', protect, admin, getAIUsageStats);

export default router;