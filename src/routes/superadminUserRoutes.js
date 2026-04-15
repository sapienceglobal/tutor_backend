import express from 'express';
import { protect, authorize } from '../middleware/auth.js'; 

import { getUserProfile, toggleUserStatus } from '../controllers/superadminUserController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('superadmin')); 

router.get('/:id/profile', getUserProfile);
router.patch('/:id/status', toggleUserStatus);

export default router;