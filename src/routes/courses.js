import express from 'express';
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  getCoursesByTutor,
  getMyCourses,
  getCourseStudentsDetailed,
} from '../controllers/courseController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllCourses);
router.get('/tutor/:tutorId', getCoursesByTutor);

// Protected routes
router.get('/my-courses', protect, authorize('tutor', 'admin'), getMyCourses);
router.get('/:id', protect, getCourseById); // Students still need to view courses
router.post('/', protect, authorize('tutor', 'admin'), createCourse);
router.patch('/:id', protect, authorize('tutor', 'admin'), updateCourse);
router.delete('/:id', protect, authorize('tutor', 'admin'), deleteCourse);
router.get('/:id/students', protect, authorize('tutor', 'admin'), getCourseStudentsDetailed);

export default router;