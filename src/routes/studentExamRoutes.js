import express from 'express';
import { getAllExams, getExamById, submitExam, getAttemptDetails, logTabSwitch, checkCanAttempt, getExamHistory } from '../controllers/studentExamController.js';
import { getNextAdaptiveQuestion } from '../controllers/examController.js';
import { createReevaluationRequest, getMyReevaluationRequests } from '../controllers/examReevaluationController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, authorize('student'));

router.get('/all', getAllExams);
router.get('/history-all', getExamHistory);
router.get('/re-evaluation-requests', getMyReevaluationRequests);
router.post('/attempt/:attemptId/re-evaluation-request', createReevaluationRequest);

// ✅ Specific routes before /:id
router.get('/attempt/:id', getAttemptDetails);      

// ✅ Generic last mein
router.get('/:id', getExamById);                    
router.get('/:id/can-attempt', checkCanAttempt);
router.post('/:id/submit', submitExam);
router.post('/:id/next-question', getNextAdaptiveQuestion);
router.post('/:id/tab-switch', logTabSwitch);

export default router;
