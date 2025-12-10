import "./config/loadEnv.js";
import express from 'express';
import cors from 'cors';
import connectDB from './config/database.js';


// Import routes
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import tutorRoutes from './routes/tutors.js';
import appointmentRoutes from './routes/appointments.js';
import uploadRoutes from './routes/upload.js';
import courseRoutes from './routes/courses.js';
import lessonRoutes from './routes/lessons.js';
import enrollmentRoutes from './routes/enrollments.js';
import progressRoutes from './routes/progress.js';
import dashboardRoutes from './routes/Tutor/dashboard.js';
 
import examRoutes from './routes/examRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

import { configureCloudinary } from './controllers/uploadController.js';
import { verifyApiKey } from './middleware/apiKey.js';




// Load env variables



// after dotenv.config()
configureCloudinary();


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