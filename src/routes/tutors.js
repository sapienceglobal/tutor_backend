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
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.get('/profile', protect, getCurrentTutor);
router.get('/stats', protect, authorize('tutor'), getTutorStats); // Specific route before /:id
router.get('/students/:id', protect, authorize('tutor'), getTutorStudentDetails);

// Public routes
router.get('/', getAllTutors);
router.get('/category/:categoryId', getTutorsByCategory);
router.get('/:id', getTutorById); // Generic route catches everything else

// Protected routes (Tutor only)
router.post('/', protect, authorize('tutor'), createTutor);
// router.get('/profile'...) is duplicate, removed
router.patch('/:id', protect, authorize('tutor'), updateTutor);
router.delete('/:id', protect, authorize('tutor'), deleteTutor);

export default router;