import '../models/enrollment_model.dart';
import 'api_service.dart';
import 'auth_service.dart';

class EnrollmentService {
  static const String _endpoint = '/enrollments';

  // Enroll in course
  static Future<Map<String, dynamic>> enrollInCourse(String courseId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        _endpoint,
        body: {'courseId': courseId},
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get my enrollments
  static Future<List<EnrollmentModel>> getMyEnrollments({
    String? status,
  }) async {
    try {
      final token = await AuthService.getToken();

      Map<String, String>? queryParams;
      if (status != null) {
        queryParams = {'status': status};
      }

      final response = await ApiService.get(
        '$_endpoint/my-enrollments',
        token: token,
        queryParams: queryParams,
      );

      if (response['success']) {
        final List<dynamic> enrollmentsJson = response['enrollments'];
        return enrollmentsJson
            .map((json) => EnrollmentModel.fromJson(json))
            .toList();
      }
      return [];
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get enrollment by course
  static Future<EnrollmentModel?> getEnrollmentByCourse(String courseId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/course/$courseId',
        token: token,
      );

      if (response['success']) {
        return EnrollmentModel.fromJson(response['enrollment']);
      }
      return null;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get course students (Tutor)
  static Future<List<dynamic>> getCourseStudents(String courseId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/students/$courseId',
        token: token,
      );

      if (response['success']) {
        return response['students'];
      }
      return [];
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Unenroll from course
  static Future<Map<String, dynamic>> unenrollFromCourse(
    String enrollmentId,
  ) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.delete(
        '$_endpoint/$enrollmentId',
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // ✅ NEW: Update lesson progress
  static Future<Map<String, dynamic>> updateProgress({
    required String enrollmentId,
    required String lessonId,
    required int watchedDuration,
    bool isCompleted = false,
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.patch(
        '$_endpoint/$enrollmentId/progress',
        body: {
          'lessonId': lessonId,
          'watchedDuration': watchedDuration,
          'isCompleted': isCompleted,
        },
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // ✅ NEW: Check if user is enrolled in a course
  static Future<bool> checkEnrollment(String courseId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/check/$courseId',
        token: token,
      );

      return response['isEnrolled'] ?? false;
    } catch (e) {
      return false;
    }
  }
}
