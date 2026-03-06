import express from 'express';
import { generateStudyPlan, getQuickRecommendations } from '../controllers/aiStudyPlanController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/generate-study-plan', generateStudyPlan);
router.get('/quick-recommendations', getQuickRecommendations);

export default router;
