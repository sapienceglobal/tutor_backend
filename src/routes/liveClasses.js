
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
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/')
    .get(getLiveClasses)
    .post(createLiveClass);

router.route('/:id')
    .patch(updateLiveClass)
    .delete(deleteLiveClass);


router.post('/:id/join-config', getJoinConfig);
router.post('/:id/attendance', markAttendance);
router.get('/:id/attendance-report', getClassAttendanceReport);

export default router;
