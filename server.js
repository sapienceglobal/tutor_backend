import "./src/config/loadEnv.js"
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Import routes
import connectDB from './src/config/database.js';
import authRoutes from './src/routes/auth.js';
import categoryRoutes from './src/routes/categories.js';
import tutorRoutes from './src/routes/tutors.js';
import appointmentRoutes from './src/routes/appointments.js';
import uploadRoutes from './src/routes/uploadRoutes.js';
import courseRoutes from './src/routes/courses.js';
import lessonRoutes from './src/routes/lessons.js';
import lessonCommentRoutes from './src/routes/lessonCommentRoutes.js';
import enrollmentRoutes from './src/routes/enrollments.js';
import progressRoutes from './src/routes/progress.js';
import dashboardRoutes from './src/routes/Tutor/dashboard.js';
import studentDashboardRoutes from './src/routes/Student/dashboard.js';
import adminRoutes from './src/routes/admin.js';

import studentExamRoutes from './src/routes/studentExamRoutes.js';

import examRoutes from './src/routes/examRoutes.js';
import aiRoutes from './src/routes/aiRoutes.js';
import questionSetRoutes from './src/routes/questionSetRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import quizRoutes from './src/routes/quizRoutes.js';
import taxonomyRoutes from './src/routes/taxonomyRoutes.js';
import questionBankRoutes from './src/routes/questionBankRoutes.js';
import reviewRoutes from './src/routes/reviewRoutes.js';
import liveClassRoutes from './src/routes/liveClasses.js';
import wishlistRoutes from './src/routes/wishlist.js';
import reportRoutes from './src/routes/reports.js';

// --- Phase 2-5 Routes (previously missing) ---
import batchRoutes from './src/routes/batches.js';
import leaveRoutes from './src/routes/leave.js';
import calendarRoutes from './src/routes/calendar.js';
import certificateRoutes from './src/routes/certificateRoutes.js';
import cmsRoutes from './src/routes/cmsRoutes.js';
import crmRoutes from './src/routes/crmRoutes.js';
import facilityRoutes from './src/routes/facilityRoutes.js';
import paymentRoutes from './src/routes/paymentRoutes.js';
import superadminRoutes from './src/routes/superadmin.js';
import zoomConfigRoutes from './src/routes/zoomConfigRoutes.js';
import attendanceRoutes from './src/routes/attendance.js';
import assignmentRoutes from './src/routes/assignments.js';
import instituteRoutes from './src/routes/institute.js';

import { verifyApiKey } from './src/middleware/apiKey.js';
import { auditMiddleware } from './src/middleware/auditMiddleware.js';

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware — CSP: unsafe-eval removed for security; use nonce for inline scripts if needed
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "http://localhost:*", "https:"],
            frameSrc: ["'self'", "https://zoom.us"],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://195.35.20.207:5000').split(',');

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS policy does not allow this origin.'), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global Rate Limiting — 500 req/15min per IP
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict Auth Rate Limiting — 10 req/15min per IP (brute force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Public health routes (no API key required)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        service: 'tutor-backend',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Tutor Management API is running',
        service: 'tutor-backend',
        version: '1.0.0',
        docs: '/api/health'
    });
});

app.use(verifyApiKey);
app.use(auditMiddleware);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/tutor/dashboard', dashboardRoutes);
app.use('/api/student/dashboard', studentDashboardRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/exams', examRoutes);
app.use('/api/student/exams', studentExamRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/question-sets', questionSetRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/taxonomy', taxonomyRoutes);
app.use('/api/question-bank', questionBankRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/live-classes', liveClassRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/comments', lessonCommentRoutes);

// --- Phase 2-5 Routes ---
app.use('/api/batches', batchRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/zoom-config', zoomConfigRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/institutes', instituteRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Start server
const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
});

