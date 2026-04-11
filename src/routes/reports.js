import express from 'express';
import { createReport, getStudentSummaryReport } from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Existing route
router.post('/', protect, createReport);

// NAYA ROUTE: Student report summary fetch karne ke liye
router.get('/student/summary', protect, getStudentSummaryReport);

export default router;