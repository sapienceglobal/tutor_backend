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
import { protect, authorize } from '../middleware/auth.js';


const router = express.Router();

// Tutor routes (Specific routes must go BEFORE parameterized routes)
router.get('/tutor/all', protect, authorize('tutor', 'admin'), getExamsByTutor);
router.get('/student/history-all', protect, getMyAllAttempts);
router.get('/student/all', protect, getStudentExams);

router.get('/course/:courseId', protect, getExamsByCourse);
router.get('/:id', protect, getExamById);
router.get('/:id/attempts', protect, authorize('tutor', 'admin'), getExamAttempts);
router.post('/', protect, authorize('tutor', 'admin'), createExam);
router.post('/:id/submit', protect, authorize('student'), submitExam);
router.patch('/:id', protect, authorize('tutor', 'admin'), updateExam);
router.delete('/:id', protect, authorize('tutor', 'admin'), deleteExam);

router.get('/:examId/my-attempts', protect, getMyExamAttempts);
router.get('/attempt/:attemptId', protect, getAttemptDetails);

// Tutor routes
router.get('/:examId/all-attempts', protect, authorize('tutor', 'admin'), getAllExamAttempts);
router.get('/tutor/attempt/:attemptId', protect, authorize('tutor', 'admin'), getTutorAttemptDetails);

export default router;