import express from 'express';
import {
  generateLessonEmbeddings,
  generateCourseEmbeddings,
  similaritySearch,
  getEmbeddingStats,
  deleteLessonEmbeddings
} from '../controllers/vectorController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Generate embeddings for a specific lesson
router.post('/generate/:lessonId', generateLessonEmbeddings);

// Generate embeddings for all lessons in a course
router.post('/generate-course/:courseId', generateCourseEmbeddings);

// Perform similarity search for RAG
router.post('/search', similaritySearch);

// Get embedding statistics
router.get('/stats', getEmbeddingStats);

// Delete embeddings for a lesson
router.delete('/lesson/:lessonId', deleteLessonEmbeddings);

export default router;
