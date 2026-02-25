// examRoutes.js
import express from 'express';
import {
    getQuestionSetsByCourse,
    createQuestionSet,
    updateQuestionSet,
    deleteQuestionSet,
    publishSetToExam

} from '../controllers/questionSetController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/course/:courseId', protect, authorize('tutor', 'admin'), getQuestionSetsByCourse);
router.post('/', protect, authorize('tutor', 'admin'), createQuestionSet);
router.post('/:id/publish', protect, authorize('tutor', 'admin'), publishSetToExam);
router.patch('/:id', protect, authorize('tutor', 'admin'), updateQuestionSet);
router.delete('/:id', protect, authorize('tutor', 'admin'), deleteQuestionSet);

export default router;