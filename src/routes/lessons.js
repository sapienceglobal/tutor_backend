import express from 'express';
import {
  getLessonsByCourse,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  // File 
  uploadDocumentToLesson,
  deleteDocumentFromLesson,
  getLessonDocuments
} from '../controllers/lessonController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.get('/course/:courseId', protect, getLessonsByCourse);
router.get('/:id', protect, getLessonById);
router.post('/', protect, createLesson);
router.patch('/:id', protect, updateLesson);
router.delete('/:id', protect, deleteLesson);

router.post('/:lessonId/documents', protect, uploadDocumentToLesson);
router.delete('/:lessonId/documents/:documentId', protect, deleteDocumentFromLesson);
router.get('/:lessonId/documents', protect, getLessonDocuments);

export default router;