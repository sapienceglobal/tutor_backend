import express from 'express';
import { protect } from '../middleware/auth.js';
import {
    checkCourseAccess,
    checkLiveClassAccess,
    getVisibleCourses,
    getVisibleLiveClasses,
    getVisibleTutors,
    checkAppointmentAccess
} from '../controllers/hybridAccessController.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Access control routes
router.post('/check-course-access', checkCourseAccess);
router.post('/check-liveclass-access', checkLiveClassAccess);
router.post('/check-appointment-access', checkAppointmentAccess);

// Content discovery routes
router.get('/visible-courses', getVisibleCourses);
router.get('/visible-live-classes', getVisibleLiveClasses);
router.get('/visible-tutors', getVisibleTutors);

export default router;
