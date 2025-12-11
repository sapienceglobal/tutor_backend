import '../models/course_model.dart';
import 'api_service.dart';
import 'auth_service.dart';

class CourseService {
  static const String _endpoint = '/courses';

  // Get all courses
  static Future<List<CourseModel>> getAllCourses({
    String? categoryId,
    String? level,
    bool? isFree,
    String? search,
    String? tutorId,
  }) async {
    try {
      print('🔄 Fetching all courses...');
      
      Map<String, String> queryParams = {};
      if (categoryId != null) queryParams['categoryId'] = categoryId;
      if (level != null) queryParams['level'] = level;
      if (isFree != null) queryParams['isFree'] = isFree.toString();
      if (search != null) queryParams['search'] = search;
      if (tutorId != null) queryParams['tutorId'] = tutorId;

      final response = await ApiService.get(
        _endpoint,
        queryParams: queryParams,
      );

      print('📥 API Response received');

      if (response['success']) {
        final List<dynamic> coursesJson = response['courses'];
        print('📊 Total courses in response: ${coursesJson.length}');

        List<CourseModel> courses = [];
        int successCount = 0;
        int failCount = 0;

        for (int i = 0; i < coursesJson.length; i++) {
          try {
            print('\n--- Parsing course ${i + 1}/${coursesJson.length} ---');
            final course = CourseModel.fromJson(coursesJson[i]);
            courses.add(course);
            successCount++;
          } catch (e) {
            failCount++;
            print('❌ Failed to parse course $i: $e');
            print('Course data: ${coursesJson[i]}');
          }
        }

        print('\n✅ Successfully parsed: $successCount courses');
        if (failCount > 0) {
          print('❌ Failed to parse: $failCount courses');
        }

        return courses;
      }
      return [];
    } catch (e) {
      print('❌ CourseService.getAllCourses error: $e');
      throw Exception(e.toString());
    }
  }

  // Get course by ID
  static Future<Map<String, dynamic>?> getCourseById(String id) async {
    try {
      print('🔄 Fetching course: $id');
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/$id',
        token: token,
      );

      if (response['success']) {
        print('✅ Course fetched successfully');
        return {
          'course': CourseModel.fromJson(response['course']),
          'lessons': response['lessons'],
          'isEnrolled': response['isEnrolled'] ?? false,
        };
      }
      return null;
    } catch (e) {
      print('❌ CourseService.getCourseById error: $e');
      throw Exception(e.toString());
    }
  }

  // Get my courses (Tutor)
  static Future<List<CourseModel>> getMyCourses() async {
    try {
      print('🔄 Fetching my courses...');
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/my-courses',
        token: token,
      );

      print('📥 API Response received');

      if (response['success']) {
        final List<dynamic> coursesJson = response['courses'];
        print('📊 Total courses in response: ${coursesJson.length}');

        List<CourseModel> courses = [];
        int successCount = 0;
        int failCount = 0;

        for (int i = 0; i < coursesJson.length; i++) {
          try {
            print('\n--- Parsing my course ${i + 1}/${coursesJson.length} ---');
            final course = CourseModel.fromJson(coursesJson[i]);
            courses.add(course);
            successCount++;
          } catch (e) {
            failCount++;
            print('❌ Failed to parse course $i: $e');
            print('Course data: ${coursesJson[i]}');
          }
        }

        print('\n✅ Successfully parsed: $successCount courses');
        if (failCount > 0) {
          print('❌ Failed to parse: $failCount courses');
        }

        return courses;
      }
      return [];
    } catch (e) {
      print('❌ CourseService.getMyCourses error: $e');
      throw Exception(e.toString());
    }
  }

  // Create course (Tutor)
  static Future<Map<String, dynamic>> createCourse({
    required String title,
    required String description,
    required String categoryId,
    String? thumbnail,
    double price = 0,
    String level = 'beginner',
    double duration = 0,
    String language = 'English',
    List<Map<String, dynamic>>? modules,
    List<String>? requirements,
    List<String>? whatYouWillLearn,
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        _endpoint,
        body: {
          'title': title,
          'description': description,
          'categoryId': categoryId,
          if (thumbnail != null) 'thumbnail': thumbnail,
          'price': price,
          'level': level,
          'duration': duration,
          'language': language,
          if (modules != null) 'modules': modules,
          if (requirements != null) 'requirements': requirements,
          if (whatYouWillLearn != null) 'whatYouWillLearn': whatYouWillLearn,
        },
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Update course (Tutor)
  static Future<Map<String, dynamic>> updateCourse({
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

  // Delete course (Tutor)
  static Future<Map<String, dynamic>> deleteCourse(String id) async {
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