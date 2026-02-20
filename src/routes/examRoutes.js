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
  getMyAllAttempts,
  getExamsByTutor,
  getStudentExams,
} from '../controllers/examController.js';
import { protect } from '../middleware/auth.js';


const router = express.Router();

// Tutor routes (Specific routes must go BEFORE parameterized routes)
router.get('/tutor/all', protect, getExamsByTutor);
router.get('/student/history-all', protect, getMyAllAttempts);
router.get('/student/all', protect, getStudentExams);


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