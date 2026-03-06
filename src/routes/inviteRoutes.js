import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
    bulkCreateInvites,
    getInviteByToken,
    acceptInvite,
    getAdminInvites,
    resendInvite,
    revokeInvite
} from '../controllers/inviteController.js';

const router = express.Router();

// Public routes
router.get('/:token', getInviteByToken);

// Mixed routes (some protected, some public)
router.post('/accept', acceptInvite); // Remove protect middleware - user can be logged in or not

// Admin routes
router.post('/bulk', protect, authorize('admin'), bulkCreateInvites);
router.get('/', protect, authorize('admin'), getAdminInvites);
router.post('/:id/resend', protect, authorize('admin'), resendInvite);
router.delete('/:id', protect, authorize('admin'), revokeInvite);

// Admin invites sub-routes (for frontend compatibility)
router.get('/invites', protect, authorize('admin'), getAdminInvites);
router.post('/invites/bulk', protect, authorize('admin'), bulkCreateInvites);
router.get('/admin/invites', protect, authorize('admin'), getAdminInvites);
router.post('/admin/invites/bulk', protect, authorize('admin'), bulkCreateInvites);

export default router;
