import express from 'express';
import { getAllExams, getExamById, submitExam, getAttemptDetails, logTabSwitch, checkCanAttempt } from '../controllers/studentExamController.js';
import { getNextAdaptiveQuestion } from '../controllers/examController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, authorize('student'));

router.get('/all', getAllExams);
router.get('/:id', getExamById);
router.get('/:id/can-attempt', checkCanAttempt);
router.post('/:id/submit', submitExam);
router.get('/attempt/:id', getAttemptDetails);
router.post('/:id/next-question', getNextAdaptiveQuestion);
router.post('/:id/tab-switch', logTabSwitch);

export default router;
