import InstituteMembership from '../models/InstituteMembership.js';
import Institute from '../models/Institute.js';
import User from '../models/User.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Generate invite token for institute membership
// @route   POST /api/membership/generate-invite
export const generateInvite = async (req, res) => {
  try {
    const { roleInInstitute, email, permissions, metadata } = req.body;

    // Get user's current institute membership
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

    // Check if user has permission to invite (admin or tutor with permissions)
    if (userMembership.roleInInstitute !== 'admin' && 
        !userMembership.permissions?.canManageStudents) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to generate invites'
      });
    }

    const instituteId = userMembership.instituteId._id;

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    
    const membership = new InstituteMembership({
      userId: null, // Will be set when user joins
      instituteId,
      roleInInstitute,
      status: 'pending',
      joinedVia: 'invite',
      inviteToken,
      invitedBy: req.user.id,
      permissions: permissions || {},
      metadata: metadata || {}
    });

    await membership.save();

    // If email provided, send invite email
    if (email) {
      // TODO: Implement email sending
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
      message: error.message
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

    // Check if user already has active membership in this institute
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

    // Update membership with user details
    membership.userId = userId;
    membership.status = 'active';
    membership.approvedAt = new Date();
    membership.approvedBy = membership.invitedBy;
    
    await membership.save();

    // Update user's current institute if needed
    const user = await User.findById(userId);
    if (!user.instituteId) {
      user.instituteId = membership.instituteId._id;
      await user.save();
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
      message: error.message
    });
  }
};

// @desc    Get all invites for current institute
// @route   GET /api/membership/invites
export const getInvites = async (req, res) => {
  try {
    // Get user's current institute
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

    // Check if user has permission to view invites
    if (userMembership.roleInInstitute !== 'admin' && 
        !userMembership.permissions?.canManageStudents) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to view invites'
      });
    }

    // Get all invites for this institute
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
    const membership = await InstituteMembership.findOne({
      userId: req.user.id,
      status: 'active'
    }).populate('instituteId', 'name subdomain settings isActive');

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

// @desc    Create join request (self-registration)
// @route   POST /api/membership/request-join
export const requestJoin = async (req, res) => {
  try {
    const { instituteId, roleInInstitute, metadata } = req.body;
    const userId = req.user.id;

    // Check if already has membership
    const existing = await InstituteMembership.checkMembership(userId, instituteId);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Already a member of this institute'
      });
    }

    // Validate institute exists and is active
    const institute = await Institute.findById(instituteId);
    if (!institute || !institute.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Institute not found or inactive'
      });
    }

    const membership = new InstituteMembership({
      userId,
      instituteId,
      roleInInstitute,
      status: 'pending',
      joinedVia: 'self_request',
      metadata
    });

    await membership.save();

    res.status(201).json({
      success: true,
      message: 'Join request submitted successfully',
      membership
    });

  } catch (error) {
    console.error('Request join error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Approve membership request
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

    // Check if approver has permission
    const canApprove = await InstituteMembership.checkMembership(
      approvedBy, 
      membership.instituteId, 
      'admin'
    );

    if (!canApprove) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions to approve memberships'
      });
    }

    membership.status = 'active';
    membership.approvedBy = approvedBy;
    membership.approvedAt = new Date();
    
    // Add default permissions based on role
    if (permissions && Object.keys(permissions).length > 0) {
      membership.permissions = { ...membership.permissions, ...permissions };
    } else {
      membership.permissions = getDefaultPermissions(membership.roleInInstitute);
    }

    await membership.save();

    res.status(200).json({
      success: true,
      message: 'Membership approved successfully',
      membership: await membership.populate('userId instituteId approvedBy')
    });

  } catch (error) {
    console.error('Approve membership error:', error);
    res.status(500).json({
      success: false,
      message: error.message
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

    // Find current institute (most recently active)
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
      message: error.message
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

    // Update last active
    await membership.updateLastActive();
    
    // Update user's current institute
    await User.findByIdAndUpdate(userId, { instituteId });

    res.status(200).json({
      success: true,
      message: 'Institute switched successfully',
      membership: await membership.populate('instituteId')
    });

  } catch (error) {
    console.error('Switch institute error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get institute members
// @route   GET /api/membership/institute/:instituteId/members
export const getInstituteMembers = async (req, res) => {
  try {
    const { instituteId } = req.params;
    const { status = 'active', role } = req.query;

    // Check if requester has permission
    const canView = await InstituteMembership.checkMembership(
      req.user.id, 
      instituteId
    );

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
      message: error.message
    });
  }
};

// @desc    Leave institute
// @route   DELETE /api/membership/leave/:instituteId
export const leaveInstitute = async (req, res) => {
  try {
    const { instituteId } = req.params;
    const userId = req.user.id;

    const membership = await InstituteMembership.checkMembership(userId, instituteId);
    
    if (!membership) {
      return res.status(400).json({
        success: false,
        message: 'Not a member of this institute'
      });
    }

    await InstituteMembership.findByIdAndDelete(membership._id);

    res.status(200).json({
      success: true,
      message: 'Left institute successfully'
    });

  } catch (error) {
    console.error('Leave institute error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper function to get default permissions for role
function getDefaultPermissions(role) {
  const permissions = {
    student: {
      canCreateCourses: false,
      canCreateExams: false,
      canViewAnalytics: false,
      canManageStudents: false
    },
    tutor: {
      canCreateCourses: true,
      canCreateExams: true,
      canViewAnalytics: true,
      canManageStudents: false
    },
    admin: {
      canCreateCourses: true,
      canCreateExams: true,
      canViewAnalytics: true,
      canManageStudents: true
    }
  };

  return permissions[role] || permissions.student;
}
