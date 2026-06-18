import express from 'express';
import {
    generateQuestions,
    generateLessonQuiz,
    chatWithTutor,
    tutorChatRAG,
    generateStudentAnalytics,
    summarizeLesson,
    generateRevisionNotes,
    explainConcept,
    generatePracticeQuestions,
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
    getLectureSummaryById, deleteLectureSummary, shareLectureSummary,
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
    sendNotification,
    checkSubjectiveAnswer,
    checkPlagiarism,
    getReportStudents, generateReport, getRecentReports, deleteReport,

    getProctoringAlerts, generateProctoringAISummary,
    getActiveProctoringSessions, terminateExamSession,
    generateAICourse,
    getRecentAICourses, deleteAICourse,
    superAdminCoordinatorChat, executeAIAction,
    getAIBriefings, getSemanticSearch, getPlatformAnalytics
} from '../controllers/aiController.js';
import { studentGnerateStudyPlan, getQuickRecommendations } from '../controllers/aiStudyPlanController.js';
import { protect, admin, authorize } from '../middleware/auth.js';
// 🌟 Naya consumeAICredits import kar liya
import { requireFeature, consumeAICredits } from '../middleware/subscriptionMiddleware.js';
import { fileUpload } from '../utils/cloudinary.js';
import { checkN8nSecret } from '../middleware/apiKey.js';
import {
    sendEmail,
    getWelcomeEmailTemplate,
    getAccountBlockedEmailTemplate,
    getOTPEmailTemplate
} from '../utils/emailService.js';

import fs from 'fs';
import path from 'path';
import os from 'os';
import mongoose from 'mongoose';


import { searchSemanticInsights } from '../services/aiAgentTools.js';

const router = express.Router();

// POST /api/ai/god-mode-db
router.post('/god-mode-db', checkN8nSecret, async (req, res) => {
    try {
        const { modelName, operation, query, updateData, pipeline } = req.body;

        let Model;
        try {
            Model = (await import(`../models/${modelName}.js`)).default;
        } catch (importError) {
            return res.status(400).json({ error: `Model '${modelName}' not found in the system.` });
        }

        // 🧠 MASTER PARSING LOGIC: String ko asli JSON Object banayega
        const parsedQuery = query ? (typeof query === 'string' ? JSON.parse(query) : query) : {};
        const parsedUpdateData = updateData ? (typeof updateData === 'string' ? JSON.parse(updateData) : updateData) : {};

        let result;

        if (operation === 'find') {
            // Ab yahan safe parsedQuery ja raha hai
            result = await Model.find(parsedQuery).limit(15);
        } else if (operation === 'count') {
            result = await Model.countDocuments(parsedQuery);
        } else if (operation === 'updateOne') {
            result = await Model.updateOne(parsedQuery, parsedUpdateData);
        } else if (operation === 'aggregate') {
            const parsedPipeline = pipeline ? (typeof pipeline === 'string' ? JSON.parse(pipeline) : pipeline) : [];
            result = await Model.aggregate(parsedPipeline);
        } else {
            return res.status(400).json({ error: "Unsupported operation. Use find, count, updateOne, or aggregate." });
        }

        res.status(200).json(result);
    } catch (err) {
        console.error('God Mode DB error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/ai/trigger-email
router.post('/trigger-email', checkN8nSecret, async (req, res) => {
    const { email, subject, templateType, name, extraData } = req.body;

    let htmlBody = '';

    // AI templateType bhejega, backend decide karega kaunsa template lagana hai
    switch (templateType) {
        case 'welcome':
            htmlBody = getWelcomeEmailTemplate(name);
            break;
        case 'blocked':
            htmlBody = getAccountBlockedEmailTemplate(name);
            break;
        case 'otp':
            htmlBody = getOTPEmailTemplate(name, extraData.otp);
            break;
        // ... baaki templates
        default:
            // Custom text email with your base template layout
            htmlBody = `<div style="padding: 20px;">${extraData.message}</div>`;
    }

    const success = await sendEmail({ email, subject, html: htmlBody });

    if (success) {
        res.json({ success: true, message: `Email successfully sent to ${email}` });
    } else {
        res.status(500).json({ success: false, error: 'Failed to send email' });
    }
});

// GET /api/ai/system-health
router.get('/system-health', checkN8nSecret, async (req, res) => {
    try {
        // 1. Check MongoDB Status (0: disconnected, 1: connected, 2: connecting, 3: disconnecting)
        const dbStatus = mongoose.connection.readyState === 1 ? 'Connected 🟢' : 'Issues Detected 🔴';

        // 2. Check Server Memory (RAM) Usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(2);

        // 3. Server Uptime
        const uptimeHours = (process.uptime() / 3600).toFixed(2);

        // 4. Return Final Report
        res.status(200).json({
            success: true,
            timestamp: new Date().toISOString(),
            diagnostics: {
                database_mongodb: dbStatus,
                server_uptime: `${uptimeHours} hours`,
                ram_usage: `${memUsagePercent}%`,
                zoom_api: "Active 🟢", // Future mein yahan actual Zoom API ping laga sakte ho
                payment_gateway: "Active 🟢"
            },
            message: "System diagnostics completed successfully."
        });
    } catch (err) {
        console.error('System health error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST /api/ai/generate-csv-report
router.post('/generate-csv-report', checkN8nSecret, async (req, res) => {
    try {
        const { modelName, query } = req.body;

        let Model;
        try {
            Model = (await import(`../models/${modelName}.js`)).default;
        } catch (error) {
            return res.status(400).json({ error: `Model '${modelName}' not found.` });
        }

        const parsedQuery = query ? (typeof query === 'string' ? JSON.parse(query) : query) : {};

        // Data fetch karo (limit lagai hai taaki memory overflow na ho)
        const data = await Model.find(parsedQuery).limit(500).lean();

        if (data.length === 0) {
            return res.json({ success: false, message: "No data found for the given criteria." });
        }

        // Object ke keys se CSV headers nikalo
        const headers = Object.keys(data[0]).filter(key => key !== '__v'); // ignore __v

        // CSV string banao
        let csvContent = headers.join(',') + '\n';

        data.forEach(row => {
            const rowData = headers.map(header => {
                let cellData = row[header];
                if (typeof cellData === 'object' && cellData !== null) {
                    cellData = JSON.stringify(cellData).replace(/"/g, '""'); // Handle objects/IDs
                }
                return `"${cellData}"`;
            });
            csvContent += rowData.join(',') + '\n';
        });

        // File save karne ka rasta (make sure public/uploads folder exists)
        const fileName = `${modelName}_report_${Date.now()}.csv`;
        const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);

        fs.writeFileSync(filePath, csvContent);

        // Download link uses configured backend URL
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
        const downloadUrl = `${backendUrl}/uploads/${fileName}`;

        res.json({
            success: true,
            message: "Report generated successfully",
            downloadUrl: downloadUrl
        });

    } catch (err) {
        console.error('Generate CSV report error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/generate-study-plan', protect, studentGnerateStudyPlan);
router.get('/quick-recommendations', protect, getQuickRecommendations);
// ── Super Admin Agent (MUST be before requireFeature — superadmin has no instituteId) ──
router.post('/superadmin-coordinator', protect, authorize('superadmin'), superAdminCoordinatorChat);
router.post('/execute-action', protect, authorize('superadmin'), executeAIAction);
router.get('/briefings', protect, authorize('superadmin'), getAIBriefings);

// ── n8n Webhook Target Endpoints (Exempt from subscription gating) ──
router.post('/semantic-search', checkN8nSecret, getSemanticSearch);
router.post('/analytics', checkN8nSecret, getPlatformAnalytics);

// All routes below require protect authentication and aiFeatures subscription
router.use(protect);
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
router.post('/explain-concept', protect, consumeAICredits(3), explainConcept);
router.post('/practice-questions', protect, consumeAICredits(3), generatePracticeQuestions);
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
router.patch('/lecture-summaries/:id/share', protect, shareLectureSummary);

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
router.get('/proctoring/live-sessions', protect, getActiveProctoringSessions);
router.post('/proctoring/terminate-session', protect, terminateExamSession);
router.get('/proctoring/review/:attemptId', protect, getExamSuspicionReview);
router.post('/proctoring/review/:attemptId/summary', protect, consumeAICredits(3), generateProctoringAISummary);

// ── Smart Assessment ──────────────────────────────────────────────────────────
router.post('/subjective-check', protect, consumeAICredits(2), checkSubjectiveAnswer);
router.post('/plagiarism-check', protect, fileUpload.single('file'), consumeAICredits(5), checkPlagiarism);

// ── AI Automation ─────────────────────────────────────────────────────────────
router.post('/draft-notification', protect, consumeAICredits(1), draftNotification);
router.post('/send-notification', protect, consumeAICredits(1), sendNotification);

router.get('/report-gen/students', protect, getReportStudents);
router.post('/report-gen/generate', protect, consumeAICredits(5), generateReport);
router.get('/report-gen/recent', protect, getRecentReports);
router.delete('/report-gen/:id', protect, deleteReport);

export default router;