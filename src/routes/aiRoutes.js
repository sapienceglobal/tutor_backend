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

    generateAICourse, getRecentAICourses, deleteAICourse,
} from '../controllers/aiController.js';
import { protect, admin } from '../middleware/auth.js';
import { fileUpload } from '../utils/cloudinary.js';

const router = express.Router();

// Chat Session Routes (Industry Standard UI)

router.get('/chat-sessions', protect, getChatSessions);
router.post('/solve-doubt', protect, solveDoubt);
router.get('/doubt-topics', protect, getDoubtTopics);
router.get('/doubts', protect, getDoubtHistory);
router.get('/doubts/:id', protect, getDoubtById);
router.patch('/doubts/:id/rate', protect, rateDoubt);
router.post('/solve-doubt', protect, solveDoubt);
router.post('/chat-sessions', protect, createChatSession);
router.get('/chat-sessions/:id', protect, getChatSessionById);
router.delete('/chat-sessions/:id', protect, deleteChatSession);
router.post('/chat-sessions/:id/message', protect, addMessageToChatSession);

router.get('/evaluator/assignments', protect, getEvaluatorAssignments);
router.get('/evaluator/assignments/:assignmentId/submissions', protect, getEvaluatorSubmissions);
router.post('/evaluator/assignments/:assignmentId/bulk-evaluate', protect, bulkAIEvaluate);
router.post('/evaluator/submissions/:submissionId/evaluate', protect, aiEvaluateSubmission);
router.post('/evaluator/submissions/:submissionId/confirm-grade', protect, confirmAIGrade);

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
router.get('/tutor-dashboard-stats', protect, getTutorAIDashboardStats);



router.post('/simplify-notes', protect, fileUpload.single('file'), simplifyNotes);
router.get('/simplified-notes', protect, getSimplifiedNotes);
router.get('/notes-knowledge-bank', protect, getNotesKnowledgeBank);
router.get('/simplified-notes/:id', protect, getSimplifiedNoteById);
router.post('/simplified-notes/:id/share', protect, shareNoteToCourse);
router.delete('/simplified-notes/:id', protect, deleteSimplifiedNote);


router.post('/lecture-summary/generate', protect, fileUpload.single('file'), generateLectureSummary);
router.get('/lecture-summary-stats', protect, getLectureSummaryStats);
router.get('/lecture-summaries', protect, getLectureSummaries);
router.get('/lecture-summaries/:id/related', protect, getRelatedLectures);
router.get('/lecture-summaries/:id', protect, getLectureSummaryById);
router.delete('/lecture-summaries/:id', protect, deleteLectureSummary);

router.get('/weak-topics', protect, getWeakTopics);

router.get('/study-plan/students', protect, getStudyPlanStudents);
router.post('/study-plan/generate', protect, generateStudyPlan);
router.get('/study-plans', protect, getStudyPlans);
router.get('/study-plans/:id', protect, getStudyPlanById);
router.delete('/study-plans/:id', protect, deleteStudyPlan);

router.get('/risk-predictor', protect, getRiskPrediction);

router.get('/dropout-risk', protect, getDropoutRiskAnalysis);
router.get('/dropout-risk/student/:studentId', protect, getStudentDropoutRisk);

// ── Student-facing AI routes ──────────────────────────────────────────────────
router.get('/student/shared-notes', protect, getStudentSharedNotes);
router.get('/student/lecture-summaries', protect, getStudentLectureSummaries);
router.get('/student/lecture-summaries/:id', protect, getStudentLectureSummaryById);
router.get('/student/study-plans', protect, getMyStudyPlans);
router.get('/student/weak-topics', protect, getStudentWeakTopics);

// ── AI Course Builder routes ──────────────────────────────────────────────────
router.post('/course-builder/generate', protect, generateAICourse);
router.get('/course-builder/stats', protect, getCourseBuilderStats);

// ── Exam Intelligence (Proctoring & Review) routes ────────────────────────────
router.get('/proctoring/alerts', protect, getProctoringAlerts);
router.get('/proctoring/review/:attemptId', protect, getExamSuspicionReview);

// ── Smart Assessment ──────────────────────────────────────────────────────────
router.post('/subjective-check', protect, checkSubjectiveAnswer);
router.post('/plagiarism-check', protect, fileUpload.single('file'), checkPlagiarism);

// ── AI Automation ─────────────────────────────────────────────────────────────
router.post('/draft-notification', protect, draftNotification);


router.get('/report-gen/students', protect, getReportStudents);
router.post('/report-gen/generate', protect, generateReport);
router.get('/report-gen/recent', protect, getRecentReports);
router.delete('/report-gen/:id', protect, deleteReport);



router.post('/proctoring/review/:attemptId/summary', protect, generateProctoringAISummary);


router.post('/course-builder/generate', protect, generateAICourse);
router.get('/course-builder/recent', protect, getRecentAICourses);
router.delete('/course-builder/:id', protect, deleteAICourse);

export default router;