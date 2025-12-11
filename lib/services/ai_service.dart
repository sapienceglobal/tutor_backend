import 'api_service.dart';
import 'auth_service.dart';

class AIService {
  static const String _endpoint = '/ai';

  // Generate questions using AI
  static Future<Map<String, dynamic>> generateQuestions({
    required String topic,
    int count = 5,
    String difficulty = 'medium',
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        '$_endpoint/generate-questions',
        body: {
          'topic': topic,
          'count': count,
          'difficulty': difficulty,
        },
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Generate quiz for specific lesson
  static Future<Map<String, dynamic>> generateLessonQuiz({
    required String lessonTitle,
    String? lessonDescription,
    int count = 5,
    String difficulty = 'medium',
    String? customInstructions,
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        '$_endpoint/generate-lesson-quiz',
        body: {
          'lessonTitle': lessonTitle,
          if (lessonDescription != null) 'lessonDescription': lessonDescription,
          'count': count,
          'difficulty': difficulty,
          if (customInstructions != null)
            'customInstructions': customInstructions,
        },
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }
}