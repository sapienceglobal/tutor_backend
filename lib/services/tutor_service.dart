import '../models/tutor_model.dart';
import 'api_service.dart';
import 'auth_service.dart';
import '../config/api_config.dart';

class TutorService {
  // Get all tutors
  static Future<List<TutorModel>> getAllTutors({
    String? categoryId,
    double? minRating,
    double? maxRate,
    String? search,
  }) async {
    try {
      Map<String, String> queryParams = {};
      
      if (categoryId != null) queryParams['categoryId'] = categoryId;
      if (minRating != null) queryParams['minRating'] = minRating.toString();
      if (maxRate != null) queryParams['maxRate'] = maxRate.toString();
      if (search != null) queryParams['search'] = search;

      final response = await ApiService.get(
        ApiConfig.tutorsEndpoint,
        queryParams: queryParams,
      );

      if (response['success']) {
        final List<dynamic> tutorsJson = response['tutors'];
        return tutorsJson.map((json) => TutorModel.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get tutor by ID
  static Future<TutorModel?> getTutorById(String id) async {
    try {
      final response = await ApiService.get('${ApiConfig.tutorsEndpoint}/$id');

      if (response['success']) {
        return TutorModel.fromJson(response['tutor']);
      }
      return null;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get tutors by category
  static Future<List<TutorModel>> getTutorsByCategory(String categoryId) async {
    try {
      final response = await ApiService.get(
        '${ApiConfig.tutorsEndpoint}/category/$categoryId',
      );

      if (response['success']) {
        final List<dynamic> tutorsJson = response['tutors'];
        return tutorsJson.map((json) => TutorModel.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Create tutor profile
  static Future<Map<String, dynamic>> createTutorProfile({
    required String categoryId,
    required double hourlyRate,
    required int experience,
    List<String> subjects = const [],
    String bio = '',
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        ApiConfig.tutorsEndpoint,
        body: {
          'categoryId': categoryId,
          'hourlyRate': hourlyRate,
          'experience': experience,
          'subjects': subjects,
          'bio': bio,
        },
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }
}