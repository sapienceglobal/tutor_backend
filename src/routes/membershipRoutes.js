import express from 'express';
import {
  generateInvite,
  acceptInvite,
  requestJoin,
  approveMembership,
  getMyInstitutes,
  switchInstitute,
  getInstituteMembers,
  leaveInstitute,
  getInvites,
  getCurrentInstitute
} from '../controllers/membershipController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Invite management
router.post('/generate-invite', generateInvite);
router.post('/accept-invite', acceptInvite);
router.get('/invites', getInvites);
router.get('/current-institute', getCurrentInstitute);

// Join requests
router.post('/request-join', requestJoin);
router.put('/:membershipId/approve', approveMembership);

// User institute management
router.get('/my-institutes', getMyInstitutes);
router.post('/switch-institute', switchInstitute);
router.delete('/leave/:instituteId', leaveInstitute);

// Institute member management
router.get('/institute/:instituteId/members', getInstituteMembers);

export default router;
