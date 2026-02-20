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
  setInitialPassword
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

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

export default router;