import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from '../config/database.js';

// Routes
import authRoutes from '../routes/auth.js';
import categoryRoutes from '../routes/categories.js';
import tutorRoutes from '../routes/tutors.js';
import appointmentRoutes from '../routes/appointments.js';
import uploadRoutes from '../routes/upload.js';
import courseRoutes from '../routes/courses.js';
import lessonRoutes from '../routes/lessons.js';
import enrollmentRoutes from '../routes/enrollments.js'; 
import progressRoutes from '../routes/progress.js';
import dashboardRoutes from '../routes/Tutor/dashboard.js';

import { configureCloudinary } from '../controllers/uploadController.js';
import { verifyApiKey } from '../middleware/apiKey.js';

dotenv.config();
configureCloudinary();

const app = express();

connectDB();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(verifyApiKey);

// Health Check
app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, message: "Server is running" });
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

// Root
app.get('/', (req, res) => {
    res.json({ success: true, message: "Tutor API Running 🚀" });
});

// Export serverless handler
export default app;
