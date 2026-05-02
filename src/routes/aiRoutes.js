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

    getTutorAIDashboardStats,
    solveDoubt,
    getDoubtHistory, getDoubtById, rateDoubt, getDoubtTopics,
    addMessageToChatSession,
    simplifyNotes, getSimplifiedNotes, getSimplifiedNoteById,
    shareNoteToCourse, deleteSimplifiedNote, getNotesKnowledgeBank,

    getEvaluatorAssignments, getEvaluatorSubmissions,
    aiEvaluateSubmission, confirmAIGrade, bulkAIEvaluate,

    generateLectureSummary, getLectureSummaries,
    getLectureSummaryById, deleteLectureSummary,
    getLectureSummaryStats, getRelatedLectures,

    getWeakTopics,

    getStudyPlanStudents, generateStudyPlan, getStudyPlans, getStudyPlanById, deleteStudyPlan,

    getRiskPrediction,

    getDropoutRiskAnalysis, getStudentDropoutRisk,

    // Student-facing AI endpoints
    getStudentSharedNotes, getStudentLectureSummaries, getStudentLectureSummaryById, getMyStudyPlans,
    getStudentWeakTopics,

    // AI Course Builder
    getCourseBuilderStats,

    getExamSuspicionReview,

    // AI Notifications
    draftNotification,
    checkSubjectiveAnswer,
    checkPlagiarism,
    getReportStudents, generateReport, getRecentReports, deleteReport,

    getProctoringAlerts, generateProctoringAISummary,
    generateAICourse,
    getRecentAICourses, deleteAICourse,
    superAdminCoordinatorChat, executeAIAction,
    getAIBriefings
} from '../controllers/aiController.js';
import { studentGnerateStudyPlan, getQuickRecommendations } from '../controllers/aiStudyPlanController.js';
import { protect, admin, authorize } from '../middleware/auth.js';
// 🌟 Naya consumeAICredits import kar liya
import { requireFeature, consumeAICredits } from '../middleware/subscriptionMiddleware.js';
import { fileUpload } from '../utils/cloudinary.js';

const router = express.Router();



router.post('/generate-study-plan',protect, studentGnerateStudyPlan);
router.get('/quick-recommendations',protect, getQuickRecommendations);
// ── Super Admin Agent (MUST be before requireFeature — superadmin has no instituteId) ──
router.post('/superadmin-coordinator', protect, authorize('superadmin'), superAdminCoordinatorChat);
router.post('/execute-action', protect, authorize('superadmin'), executeAIAction);
router.get('/briefings', protect, authorize('superadmin'), getAIBriefings);

// All routes below require aiFeatures subscription
router.use(requireFeature('aiFeatures'));

// Chat Session Routes (Industry Standard UI)
router.get('/chat-sessions', protect, getChatSessions); // GET is free
router.get('/doubt-topics', protect, getDoubtTopics);
router.get('/doubts', protect, getDoubtHistory);
router.get('/doubts/:id', protect, getDoubtById);
router.patch('/doubts/:id/rate', protect, rateDoubt); // Rating is free (DB update)
router.get('/chat-sessions/:id', protect, getChatSessionById);
router.delete('/chat-sessions/:id', protect, deleteChatSession);

// 🌟 AI Generation Routes (Metered)
router.post('/solve-doubt', protect, consumeAICredits(1), solveDoubt);
router.post('/chat-sessions', protect, consumeAICredits(1), createChatSession);
router.post('/chat-sessions/:id/message', protect, consumeAICredits(1), addMessageToChatSession);

router.get('/evaluator/assignments', protect, getEvaluatorAssignments);
router.get('/evaluator/assignments/:assignmentId/submissions', protect, getEvaluatorSubmissions);
router.post('/evaluator/assignments/:assignmentId/bulk-evaluate', protect, consumeAICredits(10), bulkAIEvaluate); // Bulk is heavy
router.post('/evaluator/submissions/:submissionId/evaluate', protect, consumeAICredits(3), aiEvaluateSubmission);
router.post('/evaluator/submissions/:submissionId/confirm-grade', protect, confirmAIGrade); // Just DB save, free

// Content Generation & Analytics
router.post('/generate-questions', protect, consumeAICredits(3), generateQuestions);
router.post('/generate-lesson-quiz', protect, consumeAICredits(5), generateLessonQuiz);
router.post('/tutor-chat', protect, consumeAICredits(1), chatWithTutor); // Legacy
router.post('/tutor-chat-rag', protect, consumeAICredits(1), tutorChatRAG); // Legacy
router.post('/contextual-chat', protect, consumeAICredits(1), contextualChat);
router.get('/analytics/student', protect, generateStudentAnalytics); // Re-check if this calls LLM, if yes, change to POST and charge credits. Assuming DB fetch for now.
router.post('/summarize-lesson', protect, consumeAICredits(3), summarizeLesson);
router.post('/revision-notes', protect, consumeAICredits(3), generateRevisionNotes);
router.get('/usage-stats', protect, admin, getAIUsageStats);
router.get('/tutor-dashboard-stats', protect, getTutorAIDashboardStats);

router.post('/simplify-notes', protect, fileUpload.single('file'), consumeAICredits(5), simplifyNotes); // File processing costs more
router.get('/simplified-notes', protect, getSimplifiedNotes);
router.get('/notes-knowledge-bank', protect, getNotesKnowledgeBank);
router.get('/simplified-notes/:id', protect, getSimplifiedNoteById);
router.post('/simplified-notes/:id/share', protect, shareNoteToCourse);
router.delete('/simplified-notes/:id', protect, deleteSimplifiedNote);

router.post('/lecture-summary/generate', protect, fileUpload.single('file'), consumeAICredits(5), generateLectureSummary);
router.get('/lecture-summary-stats', protect, getLectureSummaryStats);
router.get('/lecture-summaries', protect, getLectureSummaries);
router.get('/lecture-summaries/:id/related', protect, getRelatedLectures);
router.get('/lecture-summaries/:id', protect, getLectureSummaryById);
router.delete('/lecture-summaries/:id', protect, deleteLectureSummary);

router.get('/weak-topics', protect, getWeakTopics); // Assuming DB aggregation

router.get('/study-plan/students', protect, getStudyPlanStudents);
router.post('/study-plan/generate', protect, consumeAICredits(5), generateStudyPlan);
router.get('/study-plans', protect, getStudyPlans);
router.get('/study-plans/:id', protect, getStudyPlanById);
router.delete('/study-plans/:id', protect, deleteStudyPlan);

router.get('/risk-predictor', protect, getRiskPrediction); // Assuming DB/Math aggregation

router.get('/dropout-risk', protect, getDropoutRiskAnalysis);
router.get('/dropout-risk/student/:studentId', protect, getStudentDropoutRisk);

// ── Student-facing AI routes ──────────────────────────────────────────────────
router.get('/student/shared-notes', protect, getStudentSharedNotes);
router.get('/student/lecture-summaries', protect, getStudentLectureSummaries);
router.get('/student/lecture-summaries/:id', protect, getStudentLectureSummaryById);
router.get('/student/study-plans', protect, getMyStudyPlans);
router.get('/student/weak-topics', protect, getStudentWeakTopics);

// ── AI Course Builder routes ──────────────────────────────────────────────────
router.post('/course-builder/generate', protect, consumeAICredits(10), generateAICourse); // Heavy Task
router.get('/course-builder/stats', protect, getCourseBuilderStats);
router.get('/course-builder/recent', protect, getRecentAICourses);
router.delete('/course-builder/:id', protect, deleteAICourse);

// ── Exam Intelligence (Proctoring & Review) routes ────────────────────────────
router.get('/proctoring/alerts', protect, getProctoringAlerts);
router.get('/proctoring/review/:attemptId', protect, getExamSuspicionReview);
router.post('/proctoring/review/:attemptId/summary', protect, consumeAICredits(3), generateProctoringAISummary);

// ── Smart Assessment ──────────────────────────────────────────────────────────
router.post('/subjective-check', protect, consumeAICredits(2), checkSubjectiveAnswer);
router.post('/plagiarism-check', protect, fileUpload.single('file'), consumeAICredits(5), checkPlagiarism);

// ── AI Automation ─────────────────────────────────────────────────────────────
router.post('/draft-notification', protect, consumeAICredits(1), draftNotification);

router.get('/report-gen/students', protect, getReportStudents);
router.post('/report-gen/generate', protect, consumeAICredits(5), generateReport);
router.get('/report-gen/recent', protect, getRecentReports);
router.delete('/report-gen/:id', protect, deleteReport);

export default router;