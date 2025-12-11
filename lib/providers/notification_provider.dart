import 'package:flutter/material.dart';
import '../models/notification_model.dart';
import '../services/notification_service.dart';

class NotificationProvider with ChangeNotifier {
  List<NotificationModel> _notifications = [];
  int _unreadCount = 0;
  bool _isLoading = false;
  String? _error;

  List<NotificationModel> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Fetch notifications
  Future<void> fetchNotifications({bool unreadOnly = false}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await NotificationService.getNotifications(
        unreadOnly: unreadOnly,
      );

      if (response['success']) {
        _notifications = response['notifications'];
        _unreadCount = response['unreadCount'];
      }
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Fetch unread count only (for badge)
  Future<void> fetchUnreadCount() async {
    try {
      _unreadCount = await NotificationService.getUnreadCount();
      notifyListeners();
    } catch (e) {
      print('Error fetching unread count: $e');
    }
  }

  // Mark as read
  Future<void> markAsRead(String notificationId) async {
    try {
      final success = await NotificationService.markAsRead(notificationId);

      if (success) {
        final index = _notifications.indexWhere((n) => n.id == notificationId);
        if (index != -1) {
          _notifications[index] = NotificationModel(
            id: _notifications[index].id,
            userId: _notifications[index].userId,
            type: _notifications[index].type,
            title: _notifications[index].title,
            message: _notifications[index].message,
            data: _notifications[index].data,
            isRead: true,
            readAt: DateTime.now(),
            createdAt: _notifications[index].createdAt,
          );
          _unreadCount = (_unreadCount - 1).clamp(0, 999);
          notifyListeners();
        }
      }
    } catch (e) {
      print('Error marking as read: $e');
    }
  }

  // Mark all as read
  Future<void> markAllAsRead() async {
    try {
      final success = await NotificationService.markAllAsRead();

      if (success) {
        _notifications = _notifications.map((n) {
          return NotificationModel(
            id: n.id,
            userId: n.userId,
            type: n.type,
            title: n.title,
            message: n.message,
            data: n.data,
            isRead: true,
            readAt: DateTime.now(),
            createdAt: n.createdAt,
          );
        }).toList();
        _unreadCount = 0;
        notifyListeners();
      }
    } catch (e) {
      print('Error marking all as read: $e');
    }
  }

  // Delete notification
  Future<void> deleteNotification(String notificationId) async {
    try {
      final success = await NotificationService.deleteNotification(notificationId);

      if (success) {
        final notification = _notifications.firstWhere((n) => n.id == notificationId);
        if (!notification.isRead) {
          _unreadCount = (_unreadCount - 1).clamp(0, 999);
        }
        _notifications.removeWhere((n) => n.id == notificationId);
        notifyListeners();
      }
    } catch (e) {
      print('Error deleting notification: $e');
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}