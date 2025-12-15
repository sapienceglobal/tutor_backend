// examRoutes.js
import express from 'express';
import {
    getQuestionSetsByCourse,
    createQuestionSet,
    updateQuestionSet,
    deleteQuestionSet,
    publishSetToExam

} from '../controllers/questionSetController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/course/:courseId', protect, getQuestionSetsByCourse);
router.post('/', protect, createQuestionSet);
router.post('/:id/publish', protect, publishSetToExam);
router.patch('/:id', protect, updateQuestionSet);
router.delete('/:id', protect, deleteQuestionSet);

export default router;