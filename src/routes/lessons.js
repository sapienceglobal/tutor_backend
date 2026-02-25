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
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.get('/course/:courseId', protect, getLessonsByCourse);
router.get('/:id', protect, getLessonById);
router.post('/', protect, authorize('tutor', 'admin'), createLesson);
router.patch('/:id', protect, authorize('tutor', 'admin'), updateLesson);
router.delete('/:id', protect, authorize('tutor', 'admin'), deleteLesson);

router.post('/:lessonId/documents', protect, authorize('tutor', 'admin'), uploadDocumentToLesson);
router.delete('/:lessonId/documents/:documentId', protect, authorize('tutor', 'admin'), deleteDocumentFromLesson);
router.get('/:lessonId/documents', protect, getLessonDocuments);

export default router;