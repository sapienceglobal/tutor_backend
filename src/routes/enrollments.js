import express from 'express';
import {
  enrollInCourse,
  getMyEnrollments,
  getEnrollmentByCourse,
  getCourseStudents,
  unenrollFromCourse,
  // updateProgress,     
  checkEnrollment,
  removeStudentFromCourse,
  getStudentAnnouncements,
  approveEnrollment,
  rejectEnrollment,
} from '../controllers/enrollmentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/', authorize('student'), enrollInCourse);
router.get('/my-enrollments', authorize('student', 'admin'), getMyEnrollments);
router.get('/my-announcements', authorize('student'), getStudentAnnouncements);
router.get('/course/:courseId', getEnrollmentByCourse);
router.get('/check/:courseId', protect, checkEnrollment);
router.get('/students/:courseId', getCourseStudents);
router.delete('/:id', unenrollFromCourse);
router.delete('/tutor/:id', removeStudentFromCourse);
// router.patch('/:id/progress', updateProgress);

// Tutor-only: approve / reject pending enrollment requests
router.patch('/:id/approve', authorize('tutor', 'admin'), approveEnrollment);
router.delete('/:id/reject', authorize('tutor', 'admin'), rejectEnrollment);

export default router;