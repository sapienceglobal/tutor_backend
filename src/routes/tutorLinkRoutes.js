import express from 'express';
import {
  requestTutorLink,
  getMyTutorLinks,
  cancelOrLeaveTutorLink,
  getTutorStudentRequests,
  approveTutorStudentLink,
  rejectTutorStudentLink,
  suspendTutorStudentLink,
  addPrivateStudentByEmail,
} from '../controllers/tutorLinkController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Student endpoints (also accessible during Pending state before 1st approval)
router.post('/request', authorize('student'), requestTutorLink);
router.get('/my-tutors', authorize('student'), getMyTutorLinks);
router.delete('/:linkId', cancelOrLeaveTutorLink);

// Tutor studio management endpoints
router.get('/requests', authorize('tutor'), getTutorStudentRequests);
router.get('/students', authorize('tutor'), getTutorStudentRequests);
router.post('/add-student', authorize('tutor'), addPrivateStudentByEmail);
router.put('/:linkId/approve', authorize('tutor'), approveTutorStudentLink);
router.put('/:linkId/reject', authorize('tutor'), rejectTutorStudentLink);
router.put('/:linkId/suspend', authorize('tutor'), suspendTutorStudentLink);

export default router;

