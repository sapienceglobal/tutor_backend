import Notification from '../models/Notification.js';
import User from '../models/User.js';

// @desc    Get user notifications
// @route   GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    let filter = { userId: req.user.id };
    if (unreadOnly === 'true') {
      filter.isRead = false;
    }

    const notifications = await Notification.find(filter)
      .populate('data.courseId', 'title thumbnail')
      .populate('data.lessonId', 'title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Mark notification as read
// @route   PATCH /api/notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
export const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get unread count
// @route   GET /api/notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

import { sendPushNotification } from '../services/fcmService.js';

// ✅ Helper function to create notification
export const createNotification = async ({
  userId,
  type,
  title,
  message,
  data = {}
}) => {
  try {
    const user = await User.findById(userId);
    
    // Check user's notification settings
    if (!user || !user.notificationSettings.push) {
      return null; // User ne push notifications off kar rakhi hai
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      data
    });

    // Fire WebSocket event in real-time
    setImmediate(async () => {
      try {
        const { emitNotification } = await import('../services/socketService.js');
        emitNotification(userId.toString(), notification);
      } catch (err) {
        console.error('Socket notification emit failed:', err);
      }
    });

    // Fire push notification asynchronously
    setImmediate(() => {
      sendPushNotification(userId, title, message, {
        type,
        notificationId: notification._id.toString(),
        ...data
      });
    });

    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    return null;
  }
};

// @desc    Register FCM Token
// @route   POST /api/notifications/register-fcm
export const registerFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM Token is required' });
    }

    // Add token to fcmTokens list if it doesn't exist
    await User.findByIdAndUpdate(
      req.user.id,
      { $addToSet: { fcmTokens: token } },
      { new: true }
    );

    res.status(200).json({ success: true, message: 'FCM Token registered successfully' });
  } catch (error) {
    console.error('Register FCM token error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Unregister FCM Token
// @route   POST /api/notifications/unregister-fcm
export const unregisterFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'FCM Token is required' });
    }

    // Remove token from fcmTokens list
    await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { fcmTokens: token } }
    );

    res.status(200).json({ success: true, message: 'FCM Token unregistered successfully' });
  } catch (error) {
    console.error('Unregister FCM token error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};