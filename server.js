import "./src/config/loadEnv.js"
import express from 'express';
import cors from 'cors';
// import dotenv from 'dotenv';

// Load env variables
// dotenv.config();

// Import routes
import connectDB from './src/config/database.js';
import authRoutes from './src/routes/auth.js';
import categoryRoutes from './src/routes/categories.js';
import tutorRoutes from './src/routes/tutors.js';
import appointmentRoutes from './src/routes/appointments.js';
import uploadRoutes from './src/routes/upload.js';
import courseRoutes from './src/routes/courses.js';
import lessonRoutes from './src/routes/lessons.js';
import enrollmentRoutes from './src/routes/enrollments.js';
import progressRoutes from './src/routes/progress.js';
import dashboardRoutes from './src/routes/Tutor/dashboard.js';

import examRoutes from './src/routes/examRoutes.js';
import aiRoutes from './src/routes/aiRoutes.js';
import questionSetRoutes from './src/routes/questionSetRoutes.js';

import notificationRoutes from './src/routes/notificationRoutes.js';

import { verifyApiKey } from './src/middleware/apiKey.js';
import quizRoutes from './src/routes/quizRoutes.js';

import reviewRoutes from './src/routes/reviewRoutes.js';
import liveClassRoutes from './src/routes/liveClasses.js';

// Initialize express app
const app = express();

// Connect to database
connectDB();


// Middleware
app.use(cors({
    origin: '*', // In production, specify your Flutter app domain
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(verifyApiKey);

// Routes
app.use('/api/auth', authRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});
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


app.use('/api/exams', examRoutes);
app.use('/api/ai', aiRoutes);

app.use('/api/notifications', notificationRoutes);
app.use('/api/question-sets', questionSetRoutes);
app.use('/api/quiz', quizRoutes)



// ... existing code ...

app.use('/api/reviews', reviewRoutes);
app.use('/api/live-classes', liveClassRoutes);



// Health check route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Tutor Management API is running 🚀',
        version: '1.0.0'
    });
});

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
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
});