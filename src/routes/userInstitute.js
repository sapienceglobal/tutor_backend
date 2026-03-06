import express from 'express';
import { protect } from '../middleware/auth.js';
import { getUserInstitute, updateUserInstitute } from '../controllers/userInstituteController.js';

const router = express.Router();

// Get user's institute information (works for all authenticated users)
router.get('/me', protect, getUserInstitute);

// Update user's institute information (admin only)
router.put('/me', protect, updateUserInstitute);

export default router;
