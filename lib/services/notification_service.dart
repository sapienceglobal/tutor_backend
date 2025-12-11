import '../models/notification_model.dart';
import 'api_service.dart';
import 'auth_service.dart';

class NotificationService {
  static const String _endpoint = '/notifications';

  // Get notifications
  static Future<Map<String, dynamic>> getNotifications({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        _endpoint,
        token: token,
        queryParams: {
          'page': page.toString(),
          'limit': limit.toString(),
          'unreadOnly': unreadOnly.toString(),
        },
      );

      if (response['success']) {
        final List<dynamic> notificationsJson = response['notifications'];
        final notifications = notificationsJson
            .map((json) => NotificationModel.fromJson(json))
            .toList();

        return {
          'success': true,
          'notifications': notifications,
          'unreadCount': response['unreadCount'] ?? 0,
          'pagination': response['pagination'],
        };
      }
      return {'success': false, 'notifications': [], 'unreadCount': 0};
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // ✅ Mark as read (FIX: Empty body add kiya)
  static Future<bool> markAsRead(String notificationId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.patch(
        '$_endpoint/$notificationId/read',
        body: {}, // ✅ Empty body required
        token: token,
      );

      return response['success'] == true;
    } catch (e) {
      return false;
    }
  }

  // ✅ Mark all as read (FIX: Empty body add kiya)
  static Future<bool> markAllAsRead() async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.patch(
        '$_endpoint/read-all',
        body: {}, // ✅ Empty body required
        token: token,
      );

      return response['success'] == true;
    } catch (e) {
      return false;
    }
  }

  // Delete notification
  static Future<bool> deleteNotification(String notificationId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.delete(
        '$_endpoint/$notificationId',
        token: token,
      );

      return response['success'] == true;
    } catch (e) {
      return false;
    }
  }

  // Get unread count
  static Future<int> getUnreadCount() async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/unread-count',
        token: token,
      );

      return response['count'] ?? 0;
    } catch (e) {
      return 0;
    }
  }
}