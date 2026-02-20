import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    getAdminStats,
    getAllTutors,
    getAllStudents,
    getAllCourses,
    deleteUser,
    deleteCourse,
    getDetailedStats,
    getFinancialStats,
    getSystemLogs,
    getTutorDetails,
    getStudentDetails,
    getAdminCourseDetails
} from '../controllers/adminController.js';

const router = express.Router();

// Protect all routes: Must be logged in AND have 'admin' role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getAdminStats);
router.get('/tutors', getAllTutors);
router.get('/students', getAllStudents);
router.get('/courses', getAllCourses);
router.delete('/users/:id', deleteUser);
router.delete('/courses/:id', deleteCourse);

// Advanced Routes
router.get('/stats/detailed', getDetailedStats);
router.get('/earnings', getFinancialStats);
router.get('/logs', getSystemLogs);

// Detail Routes
router.get('/tutors/:id', getTutorDetails);
router.get('/students/:id', getStudentDetails);
router.get('/courses/:id', getAdminCourseDetails);

export default router;
