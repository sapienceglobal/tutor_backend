import express from 'express';
import {
  getLessonsByCourse,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
} from '../controllers/lessonController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.get('/course/:courseId', protect, getLessonsByCourse);
router.get('/:id', protect, getLessonById);
router.post('/', protect, createLesson);
router.patch('/:id', protect, updateLesson);
router.delete('/:id', protect, deleteLesson);

export default router;