import express from 'express';

import {
  getAllTutors,
  getTutorById,
  getTutorsByCategory,
  createTutor,
  updateTutor,
  deleteTutor,
  getCurrentTutor
} from '../controllers/tutorController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.get('/profile', protect, getCurrentTutor);

// Public routes
router.get('/', getAllTutors);
router.get('/:id', getTutorById);
router.get('/category/:categoryId', getTutorsByCategory);

// Protected routes
router.post('/', protect, createTutor);
router.patch('/:id', protect, updateTutor);
router.delete('/:id', protect, deleteTutor);

export default router;