import express from 'express';
import {
  generateInvite,
  acceptInvite,
  requestJoin,
  approveMembership,
  rejectMembership,
  getMyInstitutes,
  getMyPendingRequests,
  getInstitutePendingRequests,
  addInstituteMember,
  switchInstitute,
  getInstituteMembers,
  leaveInstitute,
  withdrawJoinRequest,
  getInvites,
  getCurrentInstitute
} from '../controllers/membershipController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Invite management
router.post('/generate-invite', generateInvite);
router.post('/accept-invite', acceptInvite);
router.get('/invites', getInvites);
router.get('/current-institute', getCurrentInstitute);

// Join requests & admin admissions
router.post('/request-join', requestJoin);
router.delete('/requests/:membershipId/withdraw', withdrawJoinRequest);
router.get('/my-requests', getMyPendingRequests);
router.get('/requests', authorize('admin', 'tutor'), getInstitutePendingRequests);
router.get('/institute/:instituteId/requests', authorize('admin', 'tutor'), getInstitutePendingRequests);
router.post('/add-member', authorize('admin'), addInstituteMember);
router.put('/:membershipId/approve', approveMembership);
router.put('/:membershipId/reject', rejectMembership);

// User institute management
router.get('/my-institutes', getMyInstitutes);
router.post('/switch-institute', switchInstitute);
router.delete('/leave/:instituteId', leaveInstitute);

// Institute member management
router.get('/institute/:instituteId/members', getInstituteMembers);

export default router;
