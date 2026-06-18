import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { applyLeaveSchema, updateLeaveStatusSchema } from '../validations/leaveValidation.js';
import {
    applyLeave,
    getMyLeaves,
    getAllLeaves,
    updateLeaveStatus,
    updateMyLeave,
    deleteMyLeave
} from '../controllers/leaveController.js';

const router = express.Router();

router.use(protect);

// Routes for Students and Tutors
router.post('/', validate(applyLeaveSchema), applyLeave);
router.get('/my', getMyLeaves);
router.put('/:id', updateMyLeave);
router.delete('/:id', deleteMyLeave);

// Routes for Admin
router.get('/', authorize('admin'), getAllLeaves);
router.put('/:id/status', authorize('admin'), validate(updateLeaveStatusSchema), updateLeaveStatus);

export default router;
