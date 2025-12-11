import 'api_service.dart';
import 'auth_service.dart';

class ProgressService {
  static const String _endpoint = '/progress';

  /// Update lesson progress
  /// Pass completed: true when lesson is finished
  static Future<bool> updateProgress({
    required String courseId,
    required String lessonId,
    int? timeSpent,
    int? lastWatchedPosition,
    bool completed = false,
  }) async {
    try {
      final token = await AuthService.getToken();

      final body = <String, dynamic>{
        'courseId': courseId,
        'lessonId': lessonId,
      };

      if (timeSpent != null) body['timeSpent'] = timeSpent;
      if (lastWatchedPosition != null)
        body['lastWatchedPosition'] = lastWatchedPosition;
      body['completed'] = completed; // ✅ IMPORTANT: Always send this

      final response = await ApiService.post(
        _endpoint,
        body: body,
        token: token,
      );

      return response['success'] ?? false;
    } catch (e) {
      print('Update progress error: $e');
      return false;
    }
  }

  /// Get course progress
  static Future<Map<String, dynamic>> getCourseProgress(String courseId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/course/$courseId',
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  /// Get lesson progress
  static Future<Map<String, dynamic>?> getLessonProgress(
    String lessonId,
  ) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/lesson/$lessonId',
        token: token,
      );

      if (response['success']) {
        return response['progress'];
      }
      return null;
    } catch (e) {
      print('Get lesson progress error: $e');
      return null;
    }
  }

  /// Mark lesson as completed
  static Future<bool> markLessonCompleted({
    required String courseId,
    required String lessonId,
    int? totalTimeSpent,
  }) async {
    return await updateProgress(
      courseId: courseId,
      lessonId: lessonId,
      completed: true, // ✅ Mark as completed
      timeSpent: totalTimeSpent,
    );
  }
}
