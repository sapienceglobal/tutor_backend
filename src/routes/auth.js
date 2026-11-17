import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
  updateProfileImage,
  forgotPassword,
  resetPassword,
  changePassword,
  updateNotificationSettings,
  updateLanguage,
  googleAuth,
  googleCallback,
  githubAuth,
  githubCallback,
  setRole,
  setInitialPassword,
  // 2FA & Session Management
  enable2FA,
  verify2FA,
  disable2FA,
  verify2FALogin,
  getActiveSessions,
  revokeSession,
  refreshAccessToken,
  registerUserWithInvite,
  listPublicInstitutes,
  listPublicTutors,
  checkUserExists,
  upgradePersonalSubscription,
} from '../controllers/authController.js';
import {
  sendOTP,
  verifyOTPAndRegister,
} from '../controllers/otpController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Strict rate limiter for email/OTP-sending routes (prevents Nodemailer spam abuse)
const emailOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP/email requests from this IP. Please try again after 15 minutes.',
  },
});

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
});

// Public routes
router.post('/register', emailOtpLimiter, registerUser);
router.post('/register-with-invite', emailOtpLimiter, registerUserWithInvite);
router.post('/check-user-exists', checkUserExists);
router.post('/login', authLoginLimiter, loginUser);
router.post('/forgot-password', emailOtpLimiter, forgotPassword);
router.post('/reset-password/:token', emailOtpLimiter, resetPassword);

// OTP routes (public)
router.post('/send-otp', emailOtpLimiter, sendOTP);
router.post('/verify-otp-and-register', emailOtpLimiter, verifyOTPAndRegister);

// 2FA login verification (public — uses tempToken)
router.post('/verify-2fa-login', verify2FALogin);

// Refresh token (public)
router.post('/refresh-token', refreshAccessToken);
router.get('/institutes', listPublicInstitutes);
router.get('/tutors', listPublicTutors);

// OAuth routes (public)
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.get('/github', githubAuth);
router.get('/github/callback', githubCallback);

// Protected routes
router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfile);
router.post('/upgrade-personal', protect, authorize('tutor'), upgradePersonalSubscription);
router.patch('/profile-image', protect, updateProfileImage);
router.post('/change-password', protect, changePassword);
router.post('/set-password', protect, setInitialPassword);
router.patch('/notification-settings', protect, updateNotificationSettings);
router.patch('/language', protect, updateLanguage);
router.post('/set-role', protect, setRole);

// 2FA management (protected)
router.post('/enable-2fa', protect, enable2FA);
router.post('/verify-2fa', protect, verify2FA);
router.post('/disable-2fa', protect, disable2FA);

// Session management (protected)
router.get('/sessions', protect, getActiveSessions);
router.delete('/sessions/:sessionId', protect, revokeSession);

export default router;
