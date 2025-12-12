import express from 'express';
import {
  enrollInCourse,
  getMyEnrollments,
  getEnrollmentByCourse,
  getCourseStudents,
  unenrollFromCourse,
    updateProgress,     
  checkEnrollment,
} from '../controllers/enrollmentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/', enrollInCourse);
router.get('/my-enrollments', getMyEnrollments);
router.get('/course/:courseId', getEnrollmentByCourse);
router.get('/check/:courseId', protect, checkEnrollment);
router.get('/students/:courseId', getCourseStudents);
router.delete('/:id', unenrollFromCourse);
router.patch('/:id/progress', updateProgress);

export default router;