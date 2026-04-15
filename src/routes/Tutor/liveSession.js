import express from 'express';
import { protect, authorize } from '../../middleware/auth.js';
import { startLiveSession } from '../../controllers/Tutor/liveSessionController.js';

const router = express.Router();

router.use(protect, authorize('tutor'));

router.post('/start', startLiveSession);

export default router;
