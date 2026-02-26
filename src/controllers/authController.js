import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import Tutor from '../models/Tutor.js';
import Settings from '../models/Settings.js';

// Setup JWT Generator from 'crypto';

// Generate JWT Token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: '30d'
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

// @desc    Register user
// @route   POST /api/auth/register
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if Registration is globally allowed by Admin
    const settings = await Settings.findOne();
    if (settings && settings.allowRegistration === false) {
      return res.status(403).json({
        success: false,
        message: 'Registration is currently disabled by the Administrator. Please try again later.'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
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
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Security Hardening: Prevent Role Elevation
    let assignedRole = role || 'student';
    // Only allow 'student' or 'tutor' to be registered directly. Block 'admin'.
    if (assignedRole === 'admin') {
      assignedRole = 'student'; // Force down to student
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role: assignedRole
    });

    // Auto-create Tutor profile if role is 'tutor'
    if (assignedRole === 'tutor') {
      const settings = (await Settings.findOne()) || {};
      await Tutor.create({ 
        userId: user._id,
        isVerified: settings.autoApproveTutors || false
      });
    }

    // Generate token
    const token = generateToken(user._id, assignedRole);

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
        profileImage: user.profileImage,
        language: user.language,
        notificationSettings: user.notificationSettings,
        authProvider: user.authProvider,
        hasPassword: true
      }
    });
  } catch (error) {
    console.error('Register error:', error);
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
        message: 'Your account has been blocked by the Administrator. Please contact support.'
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
    // Generate token
    const token = generateToken(user._id, user.role);

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
        profileImage: user.profileImage,
        language: user.language,
        notificationSettings: user.notificationSettings,
        bio: user.bio,
        address: user.address,
        authProvider: user.authProvider,
        hasPassword: true
      }
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
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        language: user.language,
        notificationSettings: user.notificationSettings,
        createdAt: user.createdAt,
        bio: user.bio,
        address: user.address,
        authProvider: user.authProvider,
        hasPassword: Boolean(user.password)
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
        message: 'User already has a password. Please use Change Password.'
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
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  res.redirect(url);
};

// @desc    Google OAuth Callback
// @route   GET /api/auth/google/callback
export const googleCallback = async (req, res) => {
  try {
    const { code } = req.query;
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
        return res.redirect(`${FRONTEND_URL}/login?error=Your account has been blocked by the Administrator. Please contact support.`);
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
        return res.redirect(`${FRONTEND_URL}/login?error=Registration is currently disabled by the Administrator. Please try again later.`);
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

    const token = generateToken(user._id);

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
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
  res.redirect(url);
};

// @desc    GitHub OAuth Callback
// @route   GET /api/auth/github/callback
export const githubCallback = async (req, res) => {
  try {
    const { code } = req.query;
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
      return res.redirect(`${FRONTEND_URL}/login?error=Could not get email from GitHub. Please make your email public.`);
    }

    // Find or create user
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (user) {
      if (user.isBlocked) {
        return res.redirect(`${FRONTEND_URL}/login?error=Your account has been blocked by the Administrator. Please contact support.`);
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
        return res.redirect(`${FRONTEND_URL}/login?error=Registration is currently disabled by the Administrator. Please try again later.`);
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

    const token = generateToken(user._id, user.role);

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
    const { role } = req.body;

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
    await user.save();

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      message: 'Role set successfully',
      token,
      user: buildUserResponse(user)
    });
  } catch (error) {
    console.error('Set role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
