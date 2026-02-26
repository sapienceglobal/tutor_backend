import express from 'express';

import {
  getAllTutors,
  getTutorById,
  getTutorsByCategory,
  createTutor,
  updateTutor,
  deleteTutor,
  getCurrentTutor,
  getTutorStats,
  getTutorStudentDetails
} from '../controllers/tutorController.js';
import { requestPayout, getMyPayouts } from '../controllers/payoutController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.get('/profile', protect, getCurrentTutor);
router.get('/stats', protect, authorize('tutor'), getTutorStats); // Specific route before /:id
router.get('/students/:id', protect, authorize('tutor'), getTutorStudentDetails);

// Payout Routes
router.post('/payouts/request', protect, authorize('tutor'), requestPayout);
router.get('/payouts', protect, authorize('tutor'), getMyPayouts);

// Public routes
router.get('/', getAllTutors);
router.get('/category/:categoryId', getTutorsByCategory);

// Protected routes (Tutor only)
router.post('/', protect, authorize('tutor'), createTutor);
// router.get('/profile'...) is duplicate, removed
router.patch('/:id', protect, authorize('tutor'), updateTutor);
router.delete('/:id', protect, authorize('tutor'), deleteTutor);

// Generic ID route MUST be last to prevent intercepting /payouts etc.
router.get('/:id', getTutorById);

export default router;