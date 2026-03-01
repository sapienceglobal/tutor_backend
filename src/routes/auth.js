import express from 'express';
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
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// 2FA login verification (public — uses tempToken)
router.post('/verify-2fa-login', verify2FALogin);

// Refresh token (public)
router.post('/refresh-token', refreshAccessToken);

// OAuth routes (public)
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.get('/github', githubAuth);
router.get('/github/callback', githubCallback);

// Protected routes
router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfile);
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