import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  registerFcmToken,
  unregisterFcmToken
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.post('/register-fcm', registerFcmToken);
router.post('/unregister-fcm', unregisterFcmToken);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;