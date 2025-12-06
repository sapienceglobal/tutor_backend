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
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getAllCourses);
router.get('/tutor/:tutorId', getCoursesByTutor);

// Protected routes
router.get('/my-courses', protect, getMyCourses);
router.get('/:id', protect, getCourseById);
router.post('/', protect, createCourse);
router.patch('/:id', protect, updateCourse);
router.delete('/:id', protect, deleteCourse);
router.get('/:id/students', protect, getCourseStudentsDetailed);

export default router;