import '../models/category_model.dart';
import 'api_service.dart';
import 'auth_service.dart';
import '../config/api_config.dart';

class CategoryService {
  // Get all categories
  static Future<List<CategoryModel>> getAllCategories() async {
    try {
      final response = await ApiService.get(ApiConfig.categoriesEndpoint);

      if (response['success']) {
        final List<dynamic> categoriesJson = response['categories'];
        return categoriesJson
            .map((json) => CategoryModel.fromJson(json))
            .toList();
      }
      return [];
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get category by ID
  static Future<CategoryModel?> getCategoryById(String id) async {
    try {
      final response = await ApiService.get('${ApiConfig.categoriesEndpoint}/$id');

      if (response['success']) {
        return CategoryModel.fromJson(response['category']);
      }
      return null;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Create category (Admin only)
  static Future<Map<String, dynamic>> createCategory({
    required String name,
    String icon = '📚',
    String description = '',
  }) async {
    try {
      final token = await AuthService.getToken();
      
      final response = await ApiService.post(
        ApiConfig.categoriesEndpoint,
        body: {
          'name': name,
          'icon': icon,
          'description': description,
        },
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }
}