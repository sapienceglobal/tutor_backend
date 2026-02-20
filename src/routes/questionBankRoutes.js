import express from 'express';
import {
    createQuestion,
    getQuestions,
    createComprehension,
    getComprehensions
} from '../controllers/questionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/questions').post(createQuestion).get(getQuestions);
router.route('/comprehensions').post(createComprehension).get(getComprehensions);

export default router;
