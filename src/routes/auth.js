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
  updateLanguage
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfile);
router.patch('/profile-image', protect, updateProfileImage);
router.post('/change-password', protect, changePassword);
router.patch('/notification-settings', protect, updateNotificationSettings);
router.patch('/language', protect, updateLanguage);

export default router;