import express from 'express';
import {
    createSkill,
    getSkills,
    createTopic,
    getTopics
} from '../controllers/taxonomyController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All routes protected

router.route('/skills').post(createSkill).get(getSkills);
router.route('/topics').post(createTopic).get(getTopics);

export default router;
