import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 

import { getLiveRadar, forceKillSession } from '../controllers/superadminLiveController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('superadmin')); 

router.get('/radar', getLiveRadar);


router.patch('/:id/force-kill', forceKillSession);

export default router;