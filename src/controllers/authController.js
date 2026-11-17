import User from '../models/User.js';
import InstituteMembership from '../models/InstituteMembership.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import mongoose from 'mongoose';
import Tutor from '../models/Tutor.js';
import Settings from '../models/Settings.js';
import Institute from '../models/Institute.js';
import Invite from '../models/Invite.js';
import { getTutorFreeSubscriptionConfig } from '../config/planDefaults.js';
import { buildWorkspaceBootstrap } from '../services/workspaceBootstrap.js';
import {
  getDefaultPermissions,
  createPendingJoinRecords,
  notifyPendingJoinRecords,
  parseSubjectsList,
} from '../services/admissionService.js';

// Setup JWT Generator from 'crypto';

// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '24h'
  });
};

// Generate refresh token (long-lived)
const generateRefreshToken = (id) => {
  return jwt.sign({ id, type: 'refresh' }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// Email transporter setup (using Gmail - free)
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD // Use App Password, not regular password
    }
  });
};

// @desc    Check if user exists
// @route   POST /api/auth/check-user-exists
export const checkUserExists = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    res.status(200).json({
      success: true,
      exists: !!user
    });
  } catch (error) {
    console.error('Check user exists error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check user existence'
    });
  }
};

// @desc    Register user
// @route   POST /api/auth/register
export const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
      instituteId,
      tutorId,
      tutorIds,
      requestedBatchId,
      requestMessage,
      subjects,
      title,
      bio,
      registrationType,
      inviteToken,
    } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let assignedInstituteId = null;
    let acceptedInvite = null;

    // Check if Registration is globally allowed by Admin
    const settings = await Settings.findOne();
    if (settings && settings.allowRegistration === false) {
      return res.status(403).json({
        success: false,
        message: 'Registration is currently disabled by the Administrator. Try again later.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Security Hardening: Prevent Role Elevation (only student or tutor can self-register)
    let assignedRole = ['student', 'tutor'].includes(role) ? role : 'student';

    // Handle invite-based registration when inviteToken is present
    if (registrationType === 'invite' || inviteToken) {
      if (!inviteToken) {
        return res.status(400).json({
          success: false,
          message: 'Invite token is required for invite-based registration'
        });
      }

      const invite = await Invite.findValidInvite(inviteToken);
      if (!invite) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired invite token. Contact the institute administrator.'
        });
      }

      if (normalizedEmail !== invite.email.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: 'Email does not match the invite email. Use the invited email address.'
        });
      }

      if (invite.role && ['student', 'tutor'].includes(invite.role)) {
        assignedRole = invite.role;
      }
      assignedInstituteId = invite.instituteId;
      acceptedInvite = invite;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userPayload = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      role: assignedRole,
      instituteId: assignedInstituteId,
      isVerified: Boolean(assignedInstituteId),
    };

    if (assignedRole === 'tutor') {
      userPayload.personalSubscription = getTutorFreeSubscriptionConfig();
    }

    const user = await User.create(userPayload);

    if (assignedRole === 'tutor') {
      await Tutor.create({
        userId: user._id,
        instituteId: assignedInstituteId,
        subjects: parseSubjectsList(subjects),
        title: title ? String(title).trim() : '',
        bio: bio ? String(bio).trim() : '',
        privateTeaching: {
          isEnabled: true,
          acceptSelfJoinRequests: true,
        },
        isVerified: settings?.autoApproveTutors || Boolean(assignedInstituteId) || false,
      });
    }

    if (acceptedInvite) {
      await InstituteMembership.create({
        userId: user._id,
        instituteId: assignedInstituteId,
        roleInInstitute: assignedRole,
        status: 'active',
        joinedVia: 'invite',
        approvedBy: acceptedInvite.invitedBy || user._id,
        approvedAt: new Date(),
        permissions: getDefaultPermissions(assignedRole),
      });
      await acceptedInvite.acceptInvite(user._id);
    } else {
      const requestedTutorIds = tutorIds || (tutorId ? [tutorId] : []);
      const pendingData = await createPendingJoinRecords({
        user,
        role: assignedRole,
        instituteId,
        tutorIds: requestedTutorIds,
        requestedBatchId,
        requestMessage,
        subjects,
        joinedVia: 'self_request',
      });
      if (pendingData.createdMemberships.length > 0 || pendingData.createdLinks.length > 0) {
        notifyPendingJoinRecords({ user, ...pendingData }).catch((err) =>
          console.warn('Register join alert warning:', err?.message || err)
        );
      }
    }

    const token = generateToken(user._id, assignedRole);
    const workspaceBootstrap = await buildWorkspaceBootstrap(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        instituteId: user.instituteId || null,
        profileImage: user.profileImage,
        language: user.language,
        notificationSettings: user.notificationSettings,
        authProvider: user.authProvider,
        personalSubscription: user.personalSubscription || null,
        hasPassword: true
      },
      workspaceBootstrap,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Register user with invite
// @route   POST /api/auth/register-with-invite
export const registerUserWithInvite = async (req, res) => {
  try {
    const { name, email, password, phone, inviteToken } = req.body;

    if (!name || !email || !password || !phone || !inviteToken) {
      return res.status(400).json({
        success: false,
        message: 'All fields and invite token are required'
      });
    }

    const membership = await InstituteMembership.findByInviteToken(inviteToken);

    if (!membership) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired invite'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userPayload = {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      role: membership.roleInInstitute,
      instituteId: membership.instituteId._id,
      isVerified: true,
    };

    if (membership.roleInInstitute === 'tutor') {
      userPayload.personalSubscription = getTutorFreeSubscriptionConfig();
    }

    const user = await User.create(userPayload);

    if (membership.roleInInstitute === 'tutor') {
      const settings = (await Settings.findOne()) || {};
      await Tutor.create({
        userId: user._id,
        instituteId: membership.instituteId._id,
        privateTeaching: {
          isEnabled: true,
          acceptSelfJoinRequests: true,
        },
        isVerified: settings.autoApproveTutors || true,
      });
    }

    membership.userId = user._id;
    membership.status = 'active';
    membership.approvedAt = new Date();
    membership.approvedBy = membership.invitedBy;

    await membership.save();

    const token = generateToken(user._id, membership.roleInInstitute);
    const workspaceBootstrap = await buildWorkspaceBootstrap(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully with invite',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        instituteId: user.instituteId || null,
        profileImage: user.profileImage,
        language: user.language,
        notificationSettings: user.notificationSettings,
        authProvider: user.authProvider,
        personalSubscription: user.personalSubscription || null,
        hasPassword: true
      },
      workspaceBootstrap,
    });
  } catch (error) {
    console.error('Register with invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check for user email
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is blocked by admin
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Account blocked by the Administrator. Contact support.'
      });
    }

    //  If they registered via OAuth and have no password
    if (!user.password) {
      const provider = user.authProvider === 'github'
        ? 'GitHub'
        : user.authProvider === 'google'
          ? 'Google'
          : 'social login';

      return res.status(400).json({
        success: false,
        code: 'OAUTH_PASSWORD_NOT_SET',
        message: `This account was created with ${provider}. Continue with ${provider} or use Forgot Password to set a password.`,
        authProvider: user.authProvider
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Password'
      });
    }

    // SECURITY: Check if 2FA is enabled — require TOTP verification before issuing JWT
    if (user.twoFactorEnabled) {
      // Generate a short-lived temp token (5 min) that can only be used for 2FA verification
      const tempToken = jwt.sign(
        { id: user._id, pending2FA: true },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      return res.status(200).json({
        success: true,
        requires2FA: true,
        tempToken,
        message: '2FA code is required to complete login'
      });
    }

    // Generate token (only if 2FA is NOT enabled)
    const token = generateToken(user._id, user.role);

    // Track session
    const device = req.headers['user-agent'] || 'Unknown';
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    const browserMatch = device.match(/(Chrome|Firefox|Safari|Edge|Opera)/i);
    const browser = browserMatch ? browserMatch[1] : 'Unknown';

    if (user.activeSessions && user.activeSessions.length >= 3) {
      user.activeSessions.sort((a, b) => new Date(a.lastActive) - new Date(b.lastActive));
      user.activeSessions.shift();
    }
    if (!user.activeSessions) user.activeSessions = [];
    user.activeSessions.push({ token, device: device.substring(0, 200), ip, browser });
    await user.save();

    const workspaceBootstrap = await buildWorkspaceBootstrap(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        instituteId: user.instituteId || null,
        profileImage: user.profileImage,
        language: user.language,
        notificationSettings: user.notificationSettings,
        bio: user.bio,
        address: user.address,
        authProvider: user.authProvider,
        hasPassword: true,
        personalSubscription: user.role === 'tutor' ? user.personalSubscription : null,
        twoFactorEnabled: user.twoFactorEnabled || false
      },
      workspaceBootstrap,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('instituteId', 'name subdomain isActive subscriptionPlan features aiUsageCount aiUsageQuota')
      .select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const workspaceBootstrap = await buildWorkspaceBootstrap(user);

    res.status(200).json({
      success: true,
      instituteSuspended: req.instituteSuspended || false,
      userBlocked: req.userBlocked || false,
      activeWorkspace: req.workspace || null,
      workspaceBootstrap,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        instituteId: user.instituteId?._id || user.instituteId || null,
        institute: user.instituteId && typeof user.instituteId === 'object' ? {
          _id: user.instituteId._id,
          name: user.instituteId.name,
          subdomain: user.instituteId.subdomain,
          isActive: user.instituteId.isActive,
          subscriptionPlan: user.instituteId.subscriptionPlan,
          features: user.instituteId.features || {},
          aiUsageCount: user.instituteId.aiUsageCount || 0,
          aiUsageQuota: user.instituteId.aiUsageQuota || 1000,
        } : null,
        profileImage: user.profileImage,
        language: user.language,
        notificationSettings: user.notificationSettings,
        createdAt: user.createdAt,
        bio: user.bio,
        address: user.address,
        authProvider: user.authProvider,
        hasPassword: Boolean(user.password),
        personalSubscription: user.role === 'tutor' ? user.personalSubscription : null,
        twoFactorEnabled: user.twoFactorEnabled || false
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Update user profile
// @route   PATCH /api/auth/profile
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, bio, address, profileImage, cloudinaryId } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate inputs
    if (name && name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters'
      });
    }

    if (phone && phone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number'
      });
    }

    if (name) user.name = name.trim();
    if (phone) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (profileImage) user.profileImage = profileImage;
    if (cloudinaryId) user.cloudinaryId = cloudinaryId;
    if (address) {
      user.address = {
        ...user.address,
        ...address
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        language: user.language,
        notificationSettings: user.notificationSettings,
        bio: user.bio,
        address: user.address
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Update profile image
// @route   PATCH /api/auth/profile-image
export const updateProfileImage = async (req, res) => {
  try {
    const { profileImage, cloudinaryId } = req.body;

    if (!profileImage) {
      return res.status(400).json({
        success: false,
        message: 'Profile image is required'
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.profileImage = profileImage;
    if (cloudinaryId) {
      user.cloudinaryId = cloudinaryId;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile image updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        language: user.language,
        notificationSettings: user.notificationSettings,
        bio: user.bio,
        address: user.address
      }
    });
  } catch (error) {
    console.error('Update profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Send Password Reset Link
// @route   POST /api/auth/forgot-password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Do not leak whether an email exists.
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent'
      });
    }

    // Generate Reset Token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and save to DB
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetTokenExpires = Date.now() + 10 * 60 * 1000; // 10 Minutes

    await user.save({ validateBeforeSave: false });

    // Create Reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/reset-password/${resetToken}`;

    try {
      const transporter = createEmailTransporter();

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Password Reset Request - Tutor Management',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2196F3;">Password Reset</h2>
            <p>Hello ${user.name},</p>
            <p>You requested to reset your password. Please click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${link}" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
            </div>
            <p style="color: #666;">Or copy and paste this link in your browser:</p>
            <p style="background-color: #f5f5f5; padding: 10px; word-break: break-all; font-size: 12px;">${link}</p>
            <p style="color: #666;">This link will expire in 10 minutes.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px;">© 2024 Tutor Management. All rights reserved.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);

      res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent'
      });
    } catch (emailError) {
      console.error('Email error:', emailError);
      user.passwordResetToken = undefined;
      user.passwordResetTokenExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: 'Email could not be sent'
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Reset Password via Token
// @route   POST /api/auth/reset-password/:token
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    // Hash token to compare with DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Clear reset fields
    user.passwordResetToken = undefined;
    user.passwordResetTokenExpires = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Change password (for logged in users)
// @route   POST /api/auth/change-password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Set initial password (for OAuth users)
// @route   POST /api/auth/set-password
export const setInitialPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.password) {
      return res.status(400).json({
        success: false,
        message: 'User password already exists. Use the change password feature.'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password set successfully'
    });

  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Update notification settings
// @route   PATCH /api/auth/notification-settings
export const updateNotificationSettings = async (req, res) => {
  try {
    const { email, push, sms } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (email !== undefined) user.notificationSettings.email = email;
    if (push !== undefined) user.notificationSettings.push = push;
    if (sms !== undefined) user.notificationSettings.sms = sms;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Notification settings updated successfully',
      notificationSettings: user.notificationSettings
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Update language preference
// @route   PATCH /api/auth/language
export const updateLanguage = async (req, res) => {
  try {
    const { language } = req.body;

    if (!language || !['en', 'hi'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language. Supported languages: en, hi'
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.language = language;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Language updated successfully',
      language: user.language
    });
  } catch (error) {
    console.error('Update language error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    List active institutes for public registration
// @desc    List listed active institutes for onboarding search (safe public metadata only)
// @route   GET /api/auth/institutes
export const listPublicInstitutes = async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim();
    const city = String(req.query?.city || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query?.limit || '30', 10) || 30, 1), 100);

    const query = {
      isActive: true,
      'discovery.isListedInSearch': { $ne: false },
    };

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: rx }, { subdomain: rx }, { 'discovery.tagline': rx }, { 'discovery.city': rx }];
    }
    if (city) {
      query['discovery.city'] = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    const institutes = await Institute.find(query)
      .select('name subdomain logo discovery')
      .sort({ name: 1 })
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      institutes
    });
  } catch (error) {
    console.error('List institutes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load institutes'
    });
  }
};

// @desc    List opt-in private tutors for onboarding search (safe public identity only)
// @route   GET /api/auth/tutors
export const listPublicTutors = async (req, res) => {
  try {
    const search = String(req.query?.search || '').trim();
    const subject = String(req.query?.subject || '').trim();
    const city = String(req.query?.city || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query?.limit || '30', 10) || 30, 1), 100);

    const query = {
      'privateTeaching.isEnabled': { $ne: false },
      'privateTeaching.acceptSelfJoinRequests': { $ne: false },
    };

    if (subject) {
      query.subjects = new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    if (city) {
      const rxCity = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ 'privateTeaching.city': rxCity }, { location: rxCity }];
    }

    const rawTutors = await Tutor.find(query)
      .populate('userId', 'name profileImage isBlocked')
      .select('userId title bio subjects experience rating studentsCount privateTeaching location isVerified')
      .sort({ rating: -1, studentsCount: -1, createdAt: -1 })
      .limit(search ? 150 : limit)
      .lean();

    const searchLower = search.toLowerCase();
    const tutors = rawTutors
      .filter((t) => t.userId && !t.userId.isBlocked)
      .filter((t) => {
        if (!searchLower) return true;
        const haystack = [
          t.userId?.name,
          t.title,
          t.privateTeaching?.headline,
          t.privateTeaching?.city,
          t.location,
          ...(t.subjects || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(searchLower);
      })
      .slice(0, limit)
      .map((t) => ({
        _id: t._id,
        tutorId: t._id,
        userId: t.userId?._id,
        name: t.userId?.name || 'Private Tutor',
        profileImage: t.userId?.profileImage || null,
        title: t.title || '',
        headline: t.privateTeaching?.headline || t.title || '',
        bio: t.bio || '',
        subjects: t.subjects || [],
        experience: t.experience || 0,
        rating: t.rating || 0,
        studentsCount: t.studentsCount || 0,
        city: t.privateTeaching?.city || t.location || '',
        isVerified: Boolean(t.isVerified),
      }));

    res.status(200).json({
      success: true,
      tutors,
    });
  } catch (error) {
    console.error('List public tutors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load tutors',
    });
  }
};

// ==========================================
// OAUTH LOGIN HANDLERS
// ==========================================

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

// Helper: Build user response object
const buildUserResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  instituteId: user.instituteId || null,
  profileImage: user.profileImage,
  language: user.language,
  notificationSettings: user.notificationSettings,
  authProvider: user.authProvider,
  hasPassword: Boolean(user.password)
});

// @desc    Initiate Google OAuth
// @route   GET /api/auth/google
export const googleAuth = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${BACKEND_URL}/api/auth/google/callback`;
  const scope = encodeURIComponent('openid email profile');

  // SECURITY: Generate CSRF state token to prevent cross-site request forgery
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000 // 10 minutes
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
  res.redirect(url);
};

// @desc    Google OAuth Callback
// @route   GET /api/auth/google/callback
export const googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    // SECURITY: Verify OAuth state to prevent CSRF
    const savedState = req.cookies?.oauth_state;
    res.clearCookie('oauth_state');
    if (!state || !savedState || state !== savedState) {
      return res.redirect(`${FRONTEND_URL}/login?error=Invalid OAuth state. Retry login.`);
    }

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/login?error=Google login failed`);
    }

    const redirectUri = `${BACKEND_URL}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Google token error:', tokenData);
      return res.redirect(`${FRONTEND_URL}/login?error=Google authentication failed`);
    }

    // Get user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();

    if (!profile.email) {
      return res.redirect(`${FRONTEND_URL}/login?error=Could not get email from Google`);
    }

    // Find or create user
    let user = await User.findOne({ email: profile.email });
    let isNewUser = false;

    if (user) {
      if (user.isBlocked) {
        return res.redirect(`${FRONTEND_URL}/login?error=Account blocked by the Administrator. Contact support.`);
      }

      // Existing user - update provider info & profile image if from OAuth
      if (!user.providerId) {
        user.authProvider = 'google';
        user.providerId = profile.id;
      }
      if (profile.picture && user.profileImage === 'https://via.placeholder.com/150') {
        user.profileImage = profile.picture;
      }
      await user.save();
    } else {
      // Check if Registration is globally allowed by Admin
      const settings = await Settings.findOne();
      if (settings && settings.allowRegistration === false) {
        return res.redirect(`${FRONTEND_URL}/login?error=Registration is currently disabled by the Administrator. Try again later.`);
      }

      // New user
      isNewUser = true;
      user = await User.create({
        name: profile.name,
        email: profile.email,
        profileImage: profile.picture || 'https://via.placeholder.com/150',
        authProvider: 'google',
        providerId: profile.id,
        role: 'student' // Temporary, will be set on role selection page
      });
    }

    // SECURITY: Generate short-lived token (5 min) to reduce query-string exposure
    const token = jwt.sign(
      { id: user._id, role: user.role, oauthRedirect: true },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    if (isNewUser) {
      // New user - redirect to role selection
      return res.redirect(`${FRONTEND_URL}/select-role?token=${token}&name=${encodeURIComponent(user.name)}&avatar=${encodeURIComponent(user.profileImage)}`);
    }

    // Existing user - redirect to callback page
    return res.redirect(`${FRONTEND_URL}/oauth-callback?token=${token}`);

  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(`${FRONTEND_URL}/login?error=Google login failed`);
  }
};

// @desc    Initiate GitHub OAuth
// @route   GET /api/auth/github
export const githubAuth = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${BACKEND_URL}/api/auth/github/callback`;
  const scope = encodeURIComponent('user:email read:user');

  // SECURITY: Generate CSRF state token
  const state = crypto.randomBytes(32).toString('hex');
  res.cookie('oauth_state_gh', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000
  });

  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
  res.redirect(url);
};

// @desc    GitHub OAuth Callback
// @route   GET /api/auth/github/callback
export const githubCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    // SECURITY: Verify OAuth state to prevent CSRF
    const savedState = req.cookies?.oauth_state_gh;
    res.clearCookie('oauth_state_gh');
    if (!state || !savedState || state !== savedState) {
      return res.redirect(`${FRONTEND_URL}/login?error=Invalid OAuth state. Retry login.`);
    }

    if (!code) {
      return res.redirect(`${FRONTEND_URL}/login?error=GitHub login failed`);
    }

    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      })
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('GitHub token error:', tokenData);
      return res.redirect(`${FRONTEND_URL}/login?error=GitHub authentication failed`);
    }

    // Get user profile
    const profileRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'TutorApp'
      }
    });
    const profile = await profileRes.json();

    // Get primary email (GitHub may not include email in profile)
    let email = profile.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'TutorApp'
        }
      });
      const emails = await emailRes.json();
      const primaryEmail = emails.find(e => e.primary && e.verified);
      email = primaryEmail?.email || emails[0]?.email;
    }

    if (!email) {
      return res.redirect(`${FRONTEND_URL}/login?error=Could not retrieve email from GitHub. Ensure the email is public.`);
    }

    // Find or create user
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (user) {
      if (user.isBlocked) {
        return res.redirect(`${FRONTEND_URL}/login?error=Account blocked by the Administrator. Contact support.`);
      }

      // Existing user - update provider info
      if (!user.providerId) {
        user.authProvider = 'github';
        user.providerId = String(profile.id);
      }
      if (profile.avatar_url && user.profileImage === 'https://via.placeholder.com/150') {
        user.profileImage = profile.avatar_url;
      }
      await user.save();
    } else {
      // Check if Registration is globally allowed by Admin
      const settings = await Settings.findOne();
      if (settings && settings.allowRegistration === false) {
        return res.redirect(`${FRONTEND_URL}/login?error=Registration is currently disabled by the Administrator. Try again later.`);
      }

      // New user
      isNewUser = true;
      user = await User.create({
        name: profile.name || profile.login,
        email,
        profileImage: profile.avatar_url || 'https://via.placeholder.com/150',
        authProvider: 'github',
        providerId: String(profile.id),
        role: 'student' // Temporary
      });
    }

    // SECURITY: Generate short-lived token (5 min) to reduce query-string exposure
    const token = jwt.sign(
      { id: user._id, role: user.role, oauthRedirect: true },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    if (isNewUser) {
      return res.redirect(`${FRONTEND_URL}/select-role?token=${token}&name=${encodeURIComponent(user.name)}&avatar=${encodeURIComponent(user.profileImage)}`);
    }

    return res.redirect(`${FRONTEND_URL}/oauth-callback?token=${token}`);

  } catch (error) {
    console.error('GitHub callback error:', error);
    return res.redirect(`${FRONTEND_URL}/login?error=GitHub login failed`);
  }
};

// @desc    Set role for new OAuth user
// @route   POST /api/auth/set-role
export const setRole = async (req, res) => {
  try {
    const {
      role,
      instituteId,
      tutorId,
      tutorIds,
      requestedBatchId,
      requestMessage,
      subjects,
      title,
      bio,
    } = req.body;

    if (!role || !['student', 'tutor'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role (student or tutor) is required'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = role;
    if (role === 'tutor' && (!user.personalSubscription || !user.personalSubscription.planName)) {
      user.personalSubscription = getTutorFreeSubscriptionConfig();
    }
    await user.save();

    if (role === 'tutor') {
      const existingTutorProfile = await Tutor.findOne({ userId: user._id });
      if (!existingTutorProfile) {
        const settings = (await Settings.findOne()) || {};
        await Tutor.create({
          userId: user._id,
          subjects: parseSubjectsList(subjects),
          title: title ? String(title).trim() : '',
          bio: bio ? String(bio).trim() : '',
          privateTeaching: {
            isEnabled: true,
            acceptSelfJoinRequests: true,
          },
          isVerified: settings.autoApproveTutors || false
        });
      }
    }

    const requestedTutorIds = tutorIds || (tutorId ? [tutorId] : []);
    if (instituteId || requestedTutorIds.length > 0) {
      const pendingData = await createPendingJoinRecords({
        user,
        role,
        instituteId,
        tutorIds: requestedTutorIds,
        requestedBatchId,
        requestMessage,
        subjects,
        joinedVia: 'self_request',
      });
      if (pendingData.createdMemberships.length > 0 || pendingData.createdLinks.length > 0) {
        notifyPendingJoinRecords({ user, ...pendingData }).catch((err) =>
          console.warn('OAuth setRole join alert warning:', err?.message || err)
        );
      }
    }

    const token = generateToken(user._id, user.role);
    const workspaceBootstrap = await buildWorkspaceBootstrap(user);

    res.json({
      success: true,
      message: 'Role set successfully',
      token,
      user: {
        ...buildUserResponse(user),
        personalSubscription: user.role === 'tutor' ? user.personalSubscription : null,
      },
      workspaceBootstrap,
    });
  } catch (error) {
    console.error('Set role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ==========================================
// 2FA & SESSION MANAGEMENT
// ==========================================

// @desc    Enable 2FA - generate secret and QR code
// @route   POST /api/auth/enable-2fa
// @access  Private
export const enable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: '2FA is already enabled' });
    }

    const secret = speakeasy.generateSecret({
      name: `Sapience (${user.email})`,
      issuer: 'Sapience LMS',
    });

    user.twoFactorSecret = secret.base32;
    await user.save();

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.status(200).json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
      message: 'Scan the QR code with your authenticator app, then verify with a code.',
    });
  } catch (error) {
    console.error('Enable 2FA error:', error);
    res.status(500).json({ success: false, message: 'Failed to enable 2FA' });
  }
};

// @desc    Verify 2FA setup
// @route   POST /api/auth/verify-2fa
// @access  Private
export const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Verification code is required' });

    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: '2FA setup must be initiated first' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    user.twoFactorEnabled = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: '2FA has been enabled successfully!',
    });
  } catch (error) {
    console.error('Verify 2FA error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify 2FA' });
  }
};

// @desc    Disable 2FA
// @route   POST /api/auth/disable-2fa
// @access  Private
export const disable2FA = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Verification code is required' });

    const user = await User.findById(req.user.id).select('+twoFactorSecret');
    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: '2FA is not enabled' });
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    await user.save();

    res.status(200).json({ success: true, message: '2FA has been disabled' });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ success: false, message: 'Failed to disable 2FA' });
  }
};

// @desc    Verify 2FA code during login
// @route   POST /api/auth/verify-2fa-login
// @access  Public (requires tempToken)
export const verify2FALogin = async (req, res) => {
  try {
    const { tempToken, token: totpCode } = req.body;

    if (!tempToken || !totpCode) {
      return res.status(400).json({ success: false, message: 'Temporary token and 2FA code are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ success: false, message: '2FA session has expired. Re-authentication is required.' });
    }

    if (!decoded.pending2FA) {
      return res.status(400).json({ success: false, message: 'Invalid token' });
    }

    const user = await User.findById(decoded.id).select('+twoFactorSecret');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: totpCode,
      window: 2,
    });

    if (!verified) {
      return res.status(401).json({ success: false, message: 'Invalid 2FA code' });
    }

    const authToken = generateToken(user._id, user.role);

    const device = req.headers['user-agent'] || 'Unknown';
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    const browserMatch = device.match(/(Chrome|Firefox|Safari|Edge|Opera)/i);
    const browser = browserMatch ? browserMatch[1] : 'Unknown';

    if (user.activeSessions && user.activeSessions.length >= 3) {
      user.activeSessions.sort((a, b) => new Date(a.lastActive) - new Date(b.lastActive));
      user.activeSessions.shift();
    }
    if (!user.activeSessions) user.activeSessions = [];
    user.activeSessions.push({ token: authToken, device: device.substring(0, 200), ip, browser });
    await user.save();

    const workspaceBootstrap = await buildWorkspaceBootstrap(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token: authToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        instituteId: user.instituteId || null,
        profileImage: user.profileImage,
        language: user.language,
        notificationSettings: user.notificationSettings,
        bio: user.bio,
        address: user.address,
        authProvider: user.authProvider,
        hasPassword: true,
        personalSubscription: user.role === 'tutor' ? user.personalSubscription : null,
        twoFactorEnabled: user.twoFactorEnabled || false
      },
      workspaceBootstrap,
    });
  } catch (error) {
    console.error('Verify 2FA login error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify 2FA' });
  }
};

// @desc    Get active sessions
// @route   GET /api/auth/sessions
// @access  Private
export const getActiveSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const currentToken = req.headers.authorization?.split(' ')[1];

    const sessions = (user.activeSessions || []).map(session => ({
      _id: session._id,
      device: session.device?.substring(0, 100),
      browser: session.browser,
      ip: session.ip,
      lastActive: session.lastActive,
      createdAt: session.createdAt,
      isCurrent: session.token === currentToken,
    }));

    res.status(200).json({
      success: true,
      sessions,
      maxSessions: 3,
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, message: 'Failed to get sessions' });
  }
};

// @desc    Revoke a session
// @route   DELETE /api/auth/sessions/:sessionId
// @access  Private
export const revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const sessionIndex = user.activeSessions.findIndex(s => s._id.toString() === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    user.activeSessions.splice(sessionIndex, 1);
    await user.save();

    res.status(200).json({ success: true, message: 'Session revoked' });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke session' });
  }
};

// @desc    Refresh access token using refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
export const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken: incomingRefreshToken } = req.body;

    if (!incomingRefreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(incomingRefreshToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token. Re-authentication is required.' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.refreshToken !== incomingRefreshToken) {
      user.refreshToken = null;
      user.activeSessions = [];
      await user.save();
      return res.status(401).json({
        success: false,
        message: 'Refresh token reuse detected. All sessions revoked. Re-authentication is required.',
      });
    }

    const newAccessToken = generateToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.status(200).json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const upgradePersonalSubscription = async (req, res) => {
  try {
    const { planId, paymentId } = req.body;

    if (req.user.role !== 'tutor') {
      return res.status(403).json({
        success: false,
        message: 'Personal subscriptions are only available for Tutors. Students use Sapience LMS completely free!'
      });
    }

    if (!planId) {
      return res.status(400).json({ success: false, message: 'Plan ID is required' });
    }

    const SubscriptionPlan = mongoose.model('SubscriptionPlan');
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    if (plan.planType !== 'personal') {
      return res.status(400).json({ success: false, message: 'Only Tutor personal plans can be activated on a tutor account' });
    }

    if (plan.planRole && !['all', 'tutor'].includes(plan.planRole)) {
      return res.status(403).json({ success: false, message: `This plan is only available for ${plan.planRole} accounts` });
    }

    // SECURITY: If the plan is paid, require a verified payment record
    if (plan.price > 0) {
      if (!paymentId) {
        return res.status(400).json({ success: false, message: 'Payment verification is required for paid plans' });
      }

      const Payment = mongoose.model('Payment');
      const payment = await Payment.findById(paymentId);

      if (!payment) {
        return res.status(404).json({ success: false, message: 'Payment record not found' });
      }

      // Verify: payment belongs to this user, is for this plan, and is actually paid
      if (payment.studentId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Payment does not belong to this user' });
      }
      if (payment.planId?.toString() !== planId) {
        return res.status(400).json({ success: false, message: 'Payment plan mismatch' });
      }
      if (payment.status !== 'paid') {
        return res.status(400).json({ success: false, message: 'Payment has not been verified yet' });
      }
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Determine subscription duration from plan billing cycle
    const durationMs = plan.billingCycle === 'yearly'
      ? 365 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;
    const subscriptionExpiresAt = plan.billingCycle === 'lifetime'
      ? null
      : new Date(Date.now() + durationMs);

    const defaults = getTutorFreeSubscriptionConfig().features;
    const planFeatures = plan.features || {};

    user.personalSubscription = {
      planName: plan.name,
      isActive: true,
      subscriptionExpiresAt,
      features: {
        maxPrivateStudents: planFeatures.maxPrivateStudents !== undefined
          ? planFeatures.maxPrivateStudents
          : defaults.maxPrivateStudents,
        maxPrivateCourses: planFeatures.maxPrivateCourses !== undefined
          ? planFeatures.maxPrivateCourses
          : defaults.maxPrivateCourses,
        aiFeatures: Boolean(planFeatures.aiAssistant || planFeatures.aiAssessment || planFeatures.aiIntelligence),
        aiCreditsPerMonth: planFeatures.aiCreditsPerMonth || 0,
        aiUsageCount: 0,
        aiAssistant: Boolean(planFeatures.aiAssistant),
        aiAssessment: Boolean(planFeatures.aiAssessment),
        aiIntelligence: Boolean(planFeatures.aiIntelligence),
        hlsStreaming: Boolean(planFeatures.hlsStreaming),
        zoomIntegration: Boolean(planFeatures.zoomIntegration),
      }
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: `Successfully activated Tutor ${plan.name} plan!`,
      personalSubscription: user.personalSubscription
    });
  } catch (error) {
    console.error('Upgrade personal subscription error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

