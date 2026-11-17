import mongoose from 'mongoose';
import InstituteMembership from '../models/InstituteMembership.js';
import Institute from '../models/Institute.js';
import User from '../models/User.js';
import Tutor from '../models/Tutor.js';
import Batch from '../models/Batch.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getTutorFreeSubscriptionConfig } from '../config/planDefaults.js';
import { checkInstituteQuota } from '../middleware/subscriptionMiddleware.js';
import {
  getDefaultPermissions,
  dispatchInstituteRequestAlerts,
  dispatchInstituteDecisionAlerts,
} from '../services/admissionService.js';

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

const canManageInstituteAdmissions = async (actor, instituteId) => {
  if (!actor || !instituteId) return false;
  if (actor.role === 'superadmin') return true;
  if (actor.role === 'admin' && actor.instituteId && String(actor.instituteId) === String(instituteId)) {
    return true;
  }
  const mem = await InstituteMembership.checkMembership(actor.id || actor._id, instituteId, 'admin');
  return Boolean(mem);
};

const activateInstituteMembershipRecord = async ({ membership, institute, user, actorId, customPermissions = null }) => {
  const quotaType = membership.roleInInstitute === 'tutor' ? 'tutors' : 'students';
  if (['tutor', 'student'].includes(membership.roleInInstitute)) {
    const quota = await checkInstituteQuota(institute, quotaType);
    if (!quota.allowed) {
      return { errorStatus: quota.status || 403, errorPayload: { success: false, ...quota } };
    }
  }

  membership.status = 'active';
  membership.userId = user._id;
  membership.approvedBy = actorId || user._id;
  membership.approvedAt = new Date();
  membership.rejectedBy = null;
  membership.rejectedAt = null;
  membership.rejectionReason = '';
  membership.permissions = customPermissions && Object.keys(customPermissions).length > 0
    ? { ...membership.permissions, ...customPermissions }
    : getDefaultPermissions(membership.roleInInstitute);
  await membership.save();

  let userChanged = false;
  if (!user.instituteId) {
    user.instituteId = institute._id;
    userChanged = true;
  }
  if (!user.isVerified) {
    user.isVerified = true;
    userChanged = true;
  }
  if (membership.roleInInstitute === 'tutor' && (!user.personalSubscription || !user.personalSubscription.planName)) {
    user.personalSubscription = getTutorFreeSubscriptionConfig();
    userChanged = true;
  }
  if (userChanged) {
    await user.save();
  }

  let tutorDoc = null;
  if (membership.roleInInstitute === 'tutor') {
    tutorDoc = await Tutor.findOneAndUpdate(
      { userId: user._id },
      {
        $setOnInsert: {
          userId: user._id,
          privateTeaching: { isEnabled: true, acceptSelfJoinRequests: true },
        },
        $set: {
          instituteId: institute._id,
          isVerified: true,
        },
      },
      { upsert: true, new: true }
    );
  }

  if (membership.requestedBatchId && mongoose.Types.ObjectId.isValid(membership.requestedBatchId)) {
    if (membership.roleInInstitute === 'student') {
      await Batch.findByIdAndUpdate(membership.requestedBatchId, { $addToSet: { students: user._id } });
    } else if (membership.roleInInstitute === 'tutor' && tutorDoc) {
      await Batch.findByIdAndUpdate(membership.requestedBatchId, { $addToSet: { instructors: tutorDoc._id } });
    }
  }

  return { membership, tutorDoc };
};

// @desc    Generate invite token for institute membership
// @route   POST /api/membership/generate-invite
export const generateInvite = async (req, res) => {
  try {
    const { roleInInstitute, email, permissions, metadata } = req.body;

    const userMembership = await InstituteMembership.findOne({
      userId: req.user.id,
      status: 'active'
    }).populate('instituteId');

    if (!userMembership) {
      return res.status(404).json({
        success: false,
        message: 'No active institute membership found'
      });
    }

    if (userMembership.roleInInstitute !== 'admin' &&
        !userMembership.permissions?.canManageStudents) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to generate invites'
      });
    }

    const instituteId = userMembership.instituteId._id;
    const sanitizedRole = ['student', 'tutor', 'admin'].includes(roleInInstitute) ? roleInInstitute : 'student';
    const inviteToken = crypto.randomBytes(32).toString('hex');

    const membership = new InstituteMembership({
      userId: null,
      instituteId,
      roleInInstitute: sanitizedRole,
      status: 'pending',
      joinedVia: 'invite',
      inviteToken,
      invitedBy: req.user.id,
      permissions: permissions || {},
      metadata: metadata || {}
    });

    await membership.save();

    if (email) {
      console.log(`Invite sent to ${email}: ${inviteToken}`);
    }

    res.status(201).json({
      success: true,
      message: 'Invite generated successfully',
      invite: {
        _id: membership._id,
        inviteToken: membership.inviteToken,
        roleInInstitute: membership.roleInInstitute,
        institute: {
          name: userMembership.instituteId.name,
          subdomain: userMembership.instituteId.subdomain
        }
      }
    });

  } catch (error) {
    console.error('Generate invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invite'
    });
  }
};

// @desc    Accept invite token
// @route   POST /api/membership/accept-invite
export const acceptInvite = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    const membership = await InstituteMembership.findByInviteToken(token);

    if (!membership) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired invite'
      });
    }

    const existingMembership = await InstituteMembership.checkMembership(
      userId,
      membership.instituteId._id
    );

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this institute'
      });
    }

    const [institute, user] = await Promise.all([
      Institute.findById(membership.instituteId._id),
      User.findById(userId),
    ]);

    if (!institute || !user) {
      return res.status(404).json({ success: false, message: 'Institute or user not found' });
    }

    const activated = await activateInstituteMembershipRecord({
      membership,
      institute,
      user,
      actorId: membership.invitedBy || userId,
    });

    if (activated.errorStatus) {
      return res.status(activated.errorStatus).json(activated.errorPayload);
    }

    res.status(200).json({
      success: true,
      message: 'Invite accepted successfully',
      membership: await membership.populate('instituteId userId')
    });

  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept invite'
    });
  }
};

// @desc    Get all invites for current institute
// @route   GET /api/membership/invites
export const getInvites = async (req, res) => {
  try {
    const userMembership = await InstituteMembership.findOne({
      userId: req.user.id,
      status: 'active'
    }).populate('instituteId');

    if (!userMembership) {
      return res.status(404).json({
        success: false,
        message: 'No active institute membership found'
      });
    }

    if (userMembership.roleInInstitute !== 'admin' &&
        !userMembership.permissions?.canManageStudents) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to view invites'
      });
    }

    const invites = await InstituteMembership.find({
      instituteId: userMembership.instituteId._id,
      status: { $in: ['pending', 'active'] }
    })
      .populate('userId', 'name email')
      .populate('invitedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      invites: invites.map(invite => ({
        _id: invite._id,
        inviteToken: invite.inviteToken,
        roleInInstitute: invite.roleInInstitute,
        status: invite.status,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        userId: invite.userId,
        invitedBy: invite.invitedBy,
        permissions: invite.permissions,
        metadata: invite.metadata
      }))
    });
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invites'
    });
  }
};

// @desc    Get current institute info
// @route   GET /api/membership/current-institute
export const getCurrentInstitute = async (req, res) => {
  try {
    const query = { userId: req.user.id, status: 'active' };
    if (req.workspace?.instituteId) {
      query.instituteId = req.workspace.instituteId;
    }

    const membership = await InstituteMembership.findOne(query)
      .populate('instituteId', 'name subdomain settings isActive');

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active institute membership found'
      });
    }

    res.status(200).json({
      success: true,
      institute: membership.instituteId,
      membership: {
        roleInInstitute: membership.roleInInstitute,
        permissions: membership.permissions
      }
    });
  } catch (error) {
    console.error('Get current institute error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get current institute'
    });
  }
};

// @desc    Create join request (self-registration by Student or Tutor)
// @route   POST /api/membership/request-join
export const requestJoin = async (req, res) => {
  try {
    const { instituteId, roleInInstitute, requestedBatchId, requestMessage, metadata } = req.body;
    const userId = req.user.id;

    if (!instituteId || !mongoose.Types.ObjectId.isValid(String(instituteId))) {
      return res.status(400).json({ success: false, message: 'Valid instituteId is required' });
    }

    const institute = await Institute.findById(instituteId);
    if (!institute || !institute.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Institute not found or inactive'
      });
    }

    const sanitizedRole = ['student', 'tutor'].includes(roleInInstitute)
      ? roleInInstitute
      : (req.user.role === 'tutor' ? 'tutor' : 'student');

    if (sanitizedRole === 'tutor' && institute.discovery?.acceptTutorRequests === false) {
      return res.status(403).json({
        success: false,
        message: 'This institute is not accepting tutor join requests right now'
      });
    }
    if (sanitizedRole === 'student' && institute.discovery?.acceptSelfJoinRequests === false) {
      return res.status(403).json({
        success: false,
        message: 'This institute is currently invite-only for students'
      });
    }

    // Single institute rule for students and faculty
    if (sanitizedRole === 'student') {
      const activeStudentMem = await InstituteMembership.findOne({
        userId,
        roleInInstitute: 'student',
        status: 'active',
      }).populate('instituteId', 'name');

      if (activeStudentMem && String(activeStudentMem.instituteId?._id || activeStudentMem.instituteId) !== String(instituteId)) {
        const currentName = activeStudentMem.instituteId?.name || 'an institute';
        return res.status(400).json({
          success: false,
          message: `You are already enrolled as a student in ${currentName}. Students can only be enrolled in one institute at a time. You can connect with private tutors for 1:1 home tutoring.`,
        });
      }
    } else if (sanitizedRole === 'tutor') {
      const activeTutorMem = await InstituteMembership.findOne({
        userId,
        roleInInstitute: 'tutor',
        status: 'active',
      }).populate('instituteId', 'name');

      if (activeTutorMem && String(activeTutorMem.instituteId?._id || activeTutorMem.instituteId) !== String(instituteId)) {
        const currentName = activeTutorMem.instituteId?.name || 'an institute';
        return res.status(400).json({
          success: false,
          message: `You are already affiliated as faculty with ${currentName}. Faculty members can only be affiliated with one institute at a time. You can teach private students independently in your Private Studio.`,
        });
      }
    }

    let membership = await InstituteMembership.findOne({ userId, instituteId });
    const cleanMessage = String(requestMessage || '').trim().slice(0, 500);
    const validBatchId = requestedBatchId && mongoose.Types.ObjectId.isValid(String(requestedBatchId))
      ? requestedBatchId
      : null;

    if (membership) {
      if (membership.status === 'active') {
        return res.status(400).json({
          success: false,
          message: 'Already a member of this institute'
        });
      }
      if (membership.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Join request is already pending approval'
        });
      }
      // Allow re-submitting after rejection/suspension
      membership.status = 'pending';
      membership.roleInInstitute = sanitizedRole;
      membership.joinedVia = 'self_request';
      membership.requestMessage = cleanMessage;
      if (validBatchId) membership.requestedBatchId = validBatchId;
      membership.rejectedBy = null;
      membership.rejectedAt = null;
      membership.rejectionReason = '';
      if (metadata) membership.metadata = metadata;
      await membership.save();
    } else {
      membership = await InstituteMembership.create({
        userId,
        instituteId,
        roleInInstitute: sanitizedRole,
        status: 'pending',
        joinedVia: 'self_request',
        requestedBatchId: validBatchId,
        requestMessage: cleanMessage,
        permissions: getDefaultPermissions(sanitizedRole),
        metadata: metadata || {},
      });
    }

    dispatchInstituteRequestAlerts({
      membership,
      institute,
      applicantUser: req.user,
      roleInInstitute: sanitizedRole,
    }).catch((err) => console.warn('Request join alert warning:', err?.message || err));

    res.status(201).json({
      success: true,
      message: 'Join request submitted successfully',
      membership
    });

  } catch (error) {
    console.error('Request join error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request join'
    });
  }
};

// @desc    Student/Tutor views their own institute requests (pending/rejected/active)
// @route   GET /api/membership/my-requests
export const getMyPendingRequests = async (req, res) => {
  try {
    const memberships = await InstituteMembership.find({
      userId: req.user.id,
      status: { $in: ['pending', 'rejected'] },
    })
      .populate('instituteId', 'name subdomain logo discovery')
      .populate('requestedBatchId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      requests: memberships,
    });
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load join requests',
    });
  }
};

// @desc    Admin views join requests for their institute
// @route   GET /api/membership/requests or /api/membership/institute/:instituteId/requests
export const getInstitutePendingRequests = async (req, res) => {
  try {
    const instituteId = req.params.instituteId || req.workspace?.instituteId || req.user.instituteId;
    const status = req.query?.status || 'pending';
    const role = req.query?.role || null;

    if (!instituteId) {
      return res.status(400).json({ success: false, message: 'Institute context required' });
    }

    const canManage = await canManageInstituteAdmissions(req.user, instituteId);
    if (!canManage) {
      return res.status(403).json({ success: false, message: 'Admin access required to review institute join requests' });
    }

    const query = { instituteId };
    if (status !== 'all' && ['pending', 'active', 'rejected', 'suspended'].includes(status)) {
      query.status = status;
    }
    if (role && ['student', 'tutor'].includes(role)) {
      query.roleInInstitute = role;
    }

    const requests = await InstituteMembership.find(query)
      .populate('userId', 'name email phone profileImage isVerified')
      .populate('requestedBatchId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      requests,
    });
  } catch (error) {
    console.error('Get institute pending requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load institute join requests',
    });
  }
};

// @desc    Approve membership request (enforces Free/Pro maxTutors & maxStudents quotas)
// @route   PUT /api/membership/:membershipId/approve
export const approveMembership = async (req, res) => {
  try {
    const { membershipId } = req.params;
    const { permissions } = req.body;
    const approvedBy = req.user.id;

    const membership = await InstituteMembership.findById(membershipId);

    if (!membership || membership.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership request'
      });
    }

    const canApprove = await canManageInstituteAdmissions(req.user, membership.instituteId);
    if (!canApprove) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to approve memberships'
      });
    }

    const [institute, memberUser] = await Promise.all([
      Institute.findById(membership.instituteId),
      User.findById(membership.userId),
    ]);

    if (!institute || !memberUser) {
      return res.status(404).json({ success: false, message: 'Institute or user not found' });
    }

    const activated = await activateInstituteMembershipRecord({
      membership,
      institute,
      user: memberUser,
      actorId: approvedBy,
      customPermissions: permissions,
    });

    if (activated.errorStatus) {
      return res.status(activated.errorStatus).json(activated.errorPayload);
    }

    dispatchInstituteDecisionAlerts({
      membership,
      institute,
      memberUser,
      decision: 'approved',
    }).catch((err) => console.warn('Approve membership alert warning:', err?.message || err));

    res.status(200).json({
      success: true,
      message: 'Membership approved successfully',
      membership: await membership.populate('userId instituteId approvedBy')
    });

  } catch (error) {
    console.error('Approve membership error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve membership'
    });
  }
};

// @desc    Reject pending membership request
// @route   PUT /api/membership/:membershipId/reject
export const rejectMembership = async (req, res) => {
  try {
    const { membershipId } = req.params;
    const reason = String(req.body?.reason || '').trim();
    const rejectedBy = req.user.id;

    const membership = await InstituteMembership.findById(membershipId);
    if (!membership || membership.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Invalid membership request'
      });
    }

    const canManage = await canManageInstituteAdmissions(req.user, membership.instituteId);
    if (!canManage) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to reject memberships'
      });
    }

    await membership.reject(rejectedBy, reason);

    const [institute, memberUser] = await Promise.all([
      Institute.findById(membership.instituteId).select('name').lean(),
      User.findById(membership.userId).select('name email').lean(),
    ]);

    if (institute && memberUser) {
      dispatchInstituteDecisionAlerts({
        membership,
        institute,
        memberUser,
        decision: 'rejected',
        reason,
      }).catch((err) => console.warn('Reject membership alert warning:', err?.message || err));
    }

    res.status(200).json({
      success: true,
      message: 'Membership request rejected',
      membership,
    });
  } catch (error) {
    console.error('Reject membership error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject membership request',
    });
  }
};

// @desc    Admin directly adds an existing Student or Tutor by email to their institute
// @route   POST /api/membership/add-member
export const addInstituteMember = async (req, res) => {
  try {
    const instituteId = req.body.instituteId || req.workspace?.instituteId || req.user.instituteId;
    const { email, roleInInstitute, permissions } = req.body;

    if (!instituteId || !email) {
      return res.status(400).json({ success: false, message: 'Institute context and member email are required' });
    }

    const canManage = await canManageInstituteAdmissions(req.user, instituteId);
    if (!canManage) {
      return res.status(403).json({ success: false, message: 'Admin permissions required' });
    }

    const [institute, targetUser] = await Promise.all([
      Institute.findById(instituteId),
      User.findOne({ email: String(email).toLowerCase().trim() }),
    ]);

    if (!institute || !institute.isActive) {
      return res.status(404).json({ success: false, message: 'Institute not found or inactive' });
    }
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'No registered user found with that email' });
    }

    const sanitizedRole = ['student', 'tutor'].includes(roleInInstitute)
      ? roleInInstitute
      : (targetUser.role === 'tutor' ? 'tutor' : 'student');

    let membership = await InstituteMembership.findOne({ userId: targetUser._id, instituteId: institute._id });
    if (membership && membership.status === 'active') {
      return res.status(400).json({ success: false, message: 'User is already an active member of this institute' });
    }

    if (!membership) {
      membership = new InstituteMembership({
        userId: targetUser._id,
        instituteId: institute._id,
        roleInInstitute: sanitizedRole,
        status: 'pending',
        joinedVia: 'admin_add',
      });
    } else {
      membership.roleInInstitute = sanitizedRole;
      membership.joinedVia = 'admin_add';
    }

    const activated = await activateInstituteMembershipRecord({
      membership,
      institute,
      user: targetUser,
      actorId: req.user.id,
      customPermissions: permissions,
    });

    if (activated.errorStatus) {
      return res.status(activated.errorStatus).json(activated.errorPayload);
    }

    dispatchInstituteDecisionAlerts({
      membership,
      institute,
      memberUser: targetUser,
      decision: 'approved',
    }).catch((err) => console.warn('Add institute member alert warning:', err?.message || err));

    res.status(201).json({
      success: true,
      message: `${targetUser.name} added to ${institute.name}`,
      membership: await membership.populate('userId', 'name email role profileImage'),
    });
  } catch (error) {
    console.error('Add institute member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add member to institute',
    });
  }
};

// @desc    Get user's active memberships
// @route   GET /api/membership/my-institutes
export const getMyInstitutes = async (req, res) => {
  try {
    const userId = req.user.id;

    const memberships = await InstituteMembership.findActiveMemberships(userId);
    const latestMembership = memberships.length > 0
      ? memberships.reduce((latest, membership) => {
          const latestTime = latest?.lastActiveAt ? new Date(latest.lastActiveAt).getTime() : 0;
          const currentTime = membership?.lastActiveAt ? new Date(membership.lastActiveAt).getTime() : 0;
          return currentTime > latestTime ? membership : latest;
        }, memberships[0])
      : null;

    const institutes = memberships.map(membership => ({
      id: membership.instituteId._id,
      name: membership.instituteId.name,
      subdomain: membership.instituteId.subdomain,
      logo: membership.instituteId.logo,
      role: membership.roleInInstitute,
      permissions: membership.permissions,
      isCurrent: Boolean(
        latestMembership
        && membership._id.toString() === latestMembership._id.toString()
      ),
      joinedAt: membership.joinedAt
    }));

    const currentInstitute = institutes.find(inst => inst.isCurrent) || institutes[0] || null;

    res.status(200).json({
      success: true,
      institutes,
      currentInstitute
    });

  } catch (error) {
    console.error('Get my institutes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get institutes'
    });
  }
};

// @desc    Switch active institute
// @route   POST /api/membership/switch-institute
export const switchInstitute = async (req, res) => {
  try {
    const { instituteId } = req.body;
    const userId = req.user.id;

    const membership = await InstituteMembership.checkMembership(userId, instituteId);

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Not a member of this institute'
      });
    }

    await membership.updateLastActive();

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        instituteId,
        role: membership.roleInInstitute
      },
      { new: true }
    );

    const newToken = generateToken(updatedUser._id, updatedUser.role);

    res.status(200).json({
      success: true,
      message: 'Institute switched successfully',
      token: newToken,
      membership: await membership.populate('instituteId'),
      user: {
        _id: updatedUser._id,
        role: updatedUser.role,
        instituteId: updatedUser.instituteId
      }
    });

  } catch (error) {
    console.error('Switch institute error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to switch institute'
    });
  }
};

// @desc    Get institute members
// @route   GET /api/membership/institute/:instituteId/members
export const getInstituteMembers = async (req, res) => {
  try {
    const { instituteId } = req.params;
    const { status = 'active', role } = req.query;

    const canView = await InstituteMembership.checkMembership(
      req.user.id,
      instituteId
    ) || req.user.role === 'superadmin';

    if (!canView) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const members = await InstituteMembership.getInstituteMembers(instituteId, { status, role });

    res.status(200).json({
      success: true,
      members
    });

  } catch (error) {
    console.error('Get institute members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get institute members'
    });
  }
};

// @desc    Leave institute
// @route   DELETE /api/membership/leave/:instituteId
export const leaveInstitute = async (req, res) => {
  try {
    const { instituteId } = req.params;
    const userId = req.user.id;

    const membership = await InstituteMembership.findOne({ userId, instituteId });

    if (!membership) {
      return res.status(400).json({
        success: false,
        message: 'Not a member of this institute'
      });
    }

    await InstituteMembership.findByIdAndDelete(membership._id);

    if (String(req.user.instituteId || '') === String(instituteId)) {
      const nextActive = await InstituteMembership.findOne({ userId, status: 'active' }).sort({ lastActiveAt: -1 });
      await User.findByIdAndUpdate(userId, { instituteId: nextActive?.instituteId || null });
    }

    res.status(200).json({
      success: true,
      message: 'Left institute successfully'
    });

  } catch (error) {
    console.error('Leave institute error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave institute'
    });
  }
};

// @desc    Withdraw / Cancel pending join request by applicant
// @route   DELETE /api/membership/requests/:membershipId/withdraw
export const withdrawJoinRequest = async (req, res) => {
  try {
    const { membershipId } = req.params;
    const userId = req.user.id;

    const membership = await InstituteMembership.findOne({
      _id: membershipId,
      userId,
      status: 'pending',
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Pending join request not found or already processed',
      });
    }

    await InstituteMembership.findByIdAndDelete(membership._id);

    res.status(200).json({
      success: true,
      message: 'Join request withdrawn successfully',
    });
  } catch (error) {
    console.error('Withdraw join request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to withdraw join request',
    });
  }
};
