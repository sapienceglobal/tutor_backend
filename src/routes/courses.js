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
  addCourseAnnouncement,
} from '../controllers/courseController.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', optionalAuth, getAllCourses);
router.get('/tutor/:tutorId', getCoursesByTutor);

// Protected routes
router.get('/my-courses', protect, authorize('tutor', 'admin'), getMyCourses);
router.get('/:id', protect, getCourseById); // Students still need to view courses
router.post('/', protect, authorize('tutor', 'admin'), createCourse);
router.patch('/:id', protect, authorize('tutor', 'admin'), updateCourse);
router.delete('/:id', protect, authorize('tutor', 'admin'), deleteCourse);
router.get('/:id/students', protect, authorize('tutor', 'admin'), getCourseStudentsDetailed);
router.post('/:id/announcements', protect, authorize('tutor', 'admin'), addCourseAnnouncement);

export default router;
