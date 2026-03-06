import express from 'express';
import {
    generateQuestions,
    generateLessonQuiz,
    chatWithTutor,
    tutorChatRAG,
    generateStudentAnalytics,
    summarizeLesson,
    generateRevisionNotes,
    getAIUsageStats,
    contextualChat,
    // Chat Session endpoints
    getChatSessions,
    getChatSessionById,
    createChatSession,
    deleteChatSession,
    addMessageToChatSession
} from '../controllers/aiController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// Chat Session Routes (Industry Standard UI)
router.get('/chat-sessions', protect, getChatSessions);
router.post('/chat-sessions', protect, createChatSession);
router.get('/chat-sessions/:id', protect, getChatSessionById);
router.delete('/chat-sessions/:id', protect, deleteChatSession);
router.post('/chat-sessions/:id/message', protect, addMessageToChatSession);

// Content Generation & Analytics
router.post('/generate-questions', protect, generateQuestions);
router.post('/generate-lesson-quiz', protect, generateLessonQuiz);
router.post('/tutor-chat', protect, chatWithTutor); // Legacy
router.post('/tutor-chat-rag', protect, tutorChatRAG); // Legacy
router.post('/contextual-chat', protect, contextualChat);
router.get('/analytics/student', protect, generateStudentAnalytics);
router.post('/summarize-lesson', protect, summarizeLesson);
router.post('/revision-notes', protect, generateRevisionNotes);
router.get('/usage-stats', protect, admin, getAIUsageStats);

export default router;