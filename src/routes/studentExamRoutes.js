import express from 'express';
import { getAllExams, getExamById, submitExam, getAttemptDetails, logTabSwitch, checkCanAttempt } from '../controllers/studentExamController.js';
import { getNextAdaptiveQuestion } from '../controllers/examController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/all', protect, getAllExams);
router.get('/:id', protect, getExamById);
router.get('/:id/can-attempt', protect, checkCanAttempt);
router.post('/:id/submit', protect, submitExam);
router.get('/attempt/:id', protect, getAttemptDetails);
router.post('/:id/next-question', protect, getNextAdaptiveQuestion);
router.post('/:id/tab-switch', protect, logTabSwitch);

export default router;
