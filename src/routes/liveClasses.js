
import express from 'express';
import {
    createLiveClass,
    getLiveClasses,
    deleteLiveClass,
    updateLiveClass,
    getJoinConfig,
    markAttendance
} from '../controllers/liveClassController.js';
import { getClassAttendanceReport } from '../controllers/attendanceController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.route('/')
    .get(getLiveClasses) // Students also need to fetch live classes
    .post(authorize('tutor', 'admin'), createLiveClass);

router.route('/:id')
    .patch(authorize('tutor', 'admin'), updateLiveClass)
    .delete(authorize('tutor', 'admin'), deleteLiveClass);


router.post('/:id/join-config', getJoinConfig);
router.post('/:id/attendance', markAttendance);
router.get('/:id/attendance-report', authorize('tutor', 'admin'), getClassAttendanceReport);

export default router;
