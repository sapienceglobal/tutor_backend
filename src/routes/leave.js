import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    applyLeave,
    getMyLeaves,
    getAllLeaves,
    updateLeaveStatus
} from '../controllers/leaveController.js';

const router = express.Router();

router.use(protect);

// Routes for Students and Tutors
router.post('/', applyLeave);
router.get('/my', getMyLeaves);

// Routes for Admin
router.get('/', authorize('admin'), getAllLeaves);
router.put('/:id/status', authorize('admin'), updateLeaveStatus);

export default router;
