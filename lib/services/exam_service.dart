// exam_service.dart
import '../models/exam_model.dart';
import 'api_service.dart';
import 'auth_service.dart';

class ExamService {
  static const String _endpoint = '/exams';

  // Get exams by course 
  static Future<Map<String, dynamic>> getExamsByCourse(String courseId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/course/$courseId',
        token: token,
      );
     
      if (response['success']) {
        final List<dynamic> examsJson = response['exams'];
        final exams = examsJson
            .map((json) => ExamModel.fromJson(json))
            .toList();

        return {'success': true, 'exams': exams};
      }
      return {'success': false, 'exams': []};
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get single exam
  static Future<Map<String, dynamic>> getExamById(String id) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get('$_endpoint/$id', token: token);

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Create exam (Tutor)
  static Future<Map<String, dynamic>> createExam({
    required String courseId,
    required String title,
    String? description,
    String type = 'assessment',
    String? instructions,
    required int duration,
    required int passingMarks,
    required List<Map<String, dynamic>> questions,
    bool shuffleQuestions = false,
    bool shuffleOptions = false,
    bool showResultImmediately = false,
    bool showCorrectAnswers = true,
    bool allowRetake = false,
    int maxAttempts = 1,
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        _endpoint,
        body: {
          'courseId': courseId,
          'title': title,
          if (description != null) 'description': description,
          'type': type,
          if (instructions != null) 'instructions': instructions,
          'duration': duration,
          'passingMarks': passingMarks,
          'questions': questions,
          'shuffleQuestions': shuffleQuestions,
          'shuffleOptions': shuffleOptions,
          'showResultImmediately': showResultImmediately,
          'showCorrectAnswers': showCorrectAnswers,
          'allowRetake': allowRetake,
          'maxAttempts': maxAttempts,
          if (startDate != null) 'startDate': startDate.toIso8601String(),
          if (endDate != null) 'endDate': endDate.toIso8601String(),
        },
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Update exam (Tutor)
  static Future<Map<String, dynamic>> updateExam({
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

  // Delete exam (Tutor)
  static Future<Map<String, dynamic>> deleteExam(String id) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.delete('$_endpoint/$id', token: token);

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Submit exam (Student)
  static Future<Map<String, dynamic>> submitExam({
    required String examId,
    required List<Map<String, dynamic>> answers,
    required int timeSpent,
    required DateTime startedAt,
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        '$_endpoint/$examId/submit',
        body: {
          'answers': answers,
          'timeSpent': timeSpent,
          'startedAt': startedAt.toIso8601String(),
        },
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get exam attempts
  static Future<Map<String, dynamic>> getExamAttempts(String examId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/$examId/attempts',
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }
}
