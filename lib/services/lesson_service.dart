import '../models/lesson_model.dart';
import 'api_service.dart';
import 'auth_service.dart';

class LessonService {
  static const String _endpoint = '/lessons';

  // Get lessons by course
  static Future<Map<String, dynamic>> getLessonsByCourse(String courseId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/course/$courseId',
        token: token,
      );

      if (response['success']) {
        final List<dynamic> lessonsJson = response['lessons'];
        final lessons = lessonsJson.map((json) => LessonModel.fromJson(json)).toList();

        return {
          'success': true,
          'lessons': lessons,
          'canAccess': response['canAccess'] ?? false,
        };
      }
      return {'success': false, 'lessons': []};
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get lesson by ID
  static Future<Map<String, dynamic>> getLessonById(String id) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/$id',
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Create lesson (Tutor)
  static Future<Map<String, dynamic>> createLesson({
    required String courseId,
    required String moduleId,
    required String title,
    String? description,
    String type = 'video',
    Map<String, dynamic>? content,
    int order = 0,
    bool isFree = false,
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        _endpoint,
        body: {
          'courseId': courseId,
          'moduleId': moduleId,
          'title': title,
          if (description != null) 'description': description,
          'type': type,
          if (content != null) 'content': content,
          'order': order,
          'isFree': isFree,
        },
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Update lesson (Tutor)
  static Future<Map<String, dynamic>> updateLesson({
    required String id,
    Map<String, dynamic>? updates,
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.patch(
        '$_endpoint/$id',
        body: updates ?? {},
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Delete lesson (Tutor)
  static Future<Map<String, dynamic>> deleteLesson(String id) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.delete(
        '$_endpoint/$id',
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }
}