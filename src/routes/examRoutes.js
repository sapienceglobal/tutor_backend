// examRoutes.js
import express from 'express';
import {
  getExamsByCourse,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  submitExam,
  getExamAttempts,
  getMyExamAttempts,
  getAllExamAttempts,
  getTutorAttemptDetails,
  getAttemptDetails,
} from '../controllers/examController.js';
import { protect } from '../middleware/auth.js';


const router = express.Router();

router.get('/course/:courseId', protect, getExamsByCourse);
router.get('/:id', protect, getExamById);
router.get('/:id/attempts', protect, getExamAttempts);
router.post('/', protect, createExam);
router.post('/:id/submit', protect, submitExam);
router.patch('/:id', protect, updateExam);
router.delete('/:id', protect, deleteExam);

router.get('/:examId/my-attempts', protect, getMyExamAttempts);
router.get('/attempt/:attemptId', protect, getAttemptDetails);

// Tutor routes
router.get('/:examId/all-attempts', protect, getAllExamAttempts);
router.get('/tutor/attempt/:attemptId', protect, getTutorAttemptDetails);

export default router;