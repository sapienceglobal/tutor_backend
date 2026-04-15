import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 
import { getGlobalExams } from '../controllers/superadminExamController.js';

const router = express.Router();

// Strict Superadmin Protection
router.use(protect);
router.use(authorize('superadmin')); 

// Read-only route for global exams and proctoring stats
router.get('/', getGlobalExams);

export default router;