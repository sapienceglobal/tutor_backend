import express from 'express';
import {
    createSkill,
    getSkills,
    createTopic,
    getTopics
} from '../controllers/taxonomyController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All routes protected

router.route('/skills').post(authorize('admin', 'tutor'), createSkill).get(getSkills);
router.route('/topics').post(authorize('admin', 'tutor'), createTopic).get(getTopics);

export default router;
