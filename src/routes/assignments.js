import express from 'express';
import {
    createAssignment,
    getCourseAssignments,
    getAssignment,
    updateAssignment,
    deleteAssignment,
    submitAssignment,
    getAssignmentSubmissions,
    gradeSubmission
} from '../controllers/assignmentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Publicly accessible inside tenant via token (protected)
router.use(protect);

// Shared Routes
router.get('/course/:courseId', getCourseAssignments);
router.get('/:id', getAssignment);

// Student Routes
router.post('/:id/submit', authorize('student'), submitAssignment);

// Tutor & Admin Routes
router.post('/', authorize('tutor', 'admin', 'superadmin'), createAssignment);
router.patch('/:id', authorize('tutor', 'admin', 'superadmin'), updateAssignment);
router.delete('/:id', authorize('tutor', 'admin', 'superadmin'), deleteAssignment);

router.get('/:id/submissions', authorize('tutor', 'admin', 'superadmin'), getAssignmentSubmissions);
router.patch('/submissions/:submissionId/grade', authorize('tutor', 'admin', 'superadmin'), gradeSubmission);

export default router;
