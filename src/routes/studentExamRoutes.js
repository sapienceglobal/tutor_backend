import express from 'express';
import { getAllExams, getExamById, submitExam, getAttemptDetails } from '../controllers/studentExamController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/all', protect, getAllExams);
router.get('/:id', protect, getExamById);
router.post('/:id/submit', protect, submitExam);
router.get('/attempt/:id', protect, getAttemptDetails);

export default router;
