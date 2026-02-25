import express from 'express';
import {
    createQuestion,
    getQuestions,
    createComprehension,
    getComprehensions
} from '../controllers/questionController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/questions').post(authorize('tutor', 'admin'), createQuestion).get(getQuestions);
router.route('/comprehensions').post(authorize('tutor', 'admin'), createComprehension).get(getComprehensions);

export default router;
