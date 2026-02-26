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
    getAdminCourseDetails,
    createUser,
    updateUser,
    updateUserStatus,
    updateCourseStatus,
    getSettings,
    updateSettings,
    verifyTutor
} from '../controllers/adminController.js';
import { getAllPayouts, updatePayoutStatus } from '../controllers/payoutController.js';

const router = express.Router();

// Protect all routes: Must be logged in AND have 'admin' role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getAdminStats);
router.get('/tutors', getAllTutors);
router.get('/students', getAllStudents);
router.get('/courses', getAllCourses);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.put('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);
router.put('/courses/:id/status', updateCourseStatus);
// System Settings (Admin Only)
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.delete('/courses/:id', deleteCourse);

// Advanced Routes
router.get('/stats/detailed', getDetailedStats);
router.get('/earnings', getFinancialStats);
router.get('/logs', getSystemLogs);

// Detail & Actions Routes
router.get('/tutors/:id', getTutorDetails);
router.put('/tutors/:id/verify', verifyTutor);
router.get('/students/:id', getStudentDetails);
router.get('/courses/:id', getAdminCourseDetails);

// Payout Routes
router.get('/payouts', getAllPayouts);
router.put('/payouts/:id', updatePayoutStatus);
// Legacy alias routes for compatibility
router.get('/payout-requests', getAllPayouts);
router.put('/payout-requests/:id', updatePayoutStatus);

export default router;
