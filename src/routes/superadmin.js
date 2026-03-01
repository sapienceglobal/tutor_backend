import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    getInstitutes,
    createInstitute,
    updateInstitute,
    getPlatformStats,
    getAllUsers,
    updateUserByAdmin,
    deleteUserByAdmin,
    getActivityLog,
    getInstituteUsers,
    impersonateUser
} from '../controllers/superadminController.js';

const router = express.Router();

// All routes require SUPERADMIN access
router.use(protect);
router.use(authorize('superadmin'));

router.get('/dashboard-stats', getPlatformStats);
router.get('/institutes', getInstitutes);
router.post('/institutes', createInstitute);
router.put('/institutes/:id', updateInstitute);
router.get('/institutes/:id/users', getInstituteUsers);

// User management
router.get('/users', getAllUsers);
router.put('/users/:id', updateUserByAdmin);
router.delete('/users/:id', deleteUserByAdmin);

// Activity log
router.get('/activity', getActivityLog);

// Impersonation
router.post('/impersonate/:userId', impersonateUser);

export default router;
