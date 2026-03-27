import express from 'express';
import {
    createQuestion,
    importQuestions,
    getQuestions,
    getQuestionById,
    updateQuestion,
    deleteQuestion,
    createComprehension,
    getComprehensions
} from '../controllers/questionController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/questions').post(authorize('tutor', 'admin'), createQuestion).get(getQuestions);
router.route('/questions/import').post(authorize('tutor', 'admin'), importQuestions);
router.route('/questions/:id').get(getQuestionById).patch(authorize('tutor', 'admin'), updateQuestion).delete(authorize('tutor', 'admin'), deleteQuestion);
router.route('/comprehensions').post(authorize('tutor', 'admin'), createComprehension).get(getComprehensions);

export default router;
