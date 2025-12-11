import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import '../models/user_model.dart';
import 'api_service.dart';
import '../config/api_config.dart';

class AuthService {
  static const String _tokenKey = 'auth_token';
  static const String _userKey = 'user_data';

  // Register user
  static Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    required String phone,
    String role = 'student',
  }) async {
    try {
      final response = await ApiService.post(
        '${ApiConfig.authEndpoint}/register',
        body: {
          'name': name,
          'email': email,
          'password': password,
          'phone': phone,
          'role': role,
        },
      );

      if (response['success']) {
        await _saveAuthData(
          token: response['token'],
          user: UserModel.fromJson(response['user']),
        );
      }

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Login user
  static Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await ApiService.post(
        '${ApiConfig.authEndpoint}/login',
        body: {'email': email, 'password': password},
      );

      if (response['success']) {
        await _saveAuthData(
          token: response['token'],
          user: UserModel.fromJson(response['user']),
        );
      }

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get current user
  static Future<UserModel?> getCurrentUser() async {
    try {
      final token = await getToken();
      if (token == null) return null;

      final response = await ApiService.get(
        '${ApiConfig.authEndpoint}/me',
        token: token,
      );

      if (response['success']) {
        final user = UserModel.fromJson(response['user']);
        await _saveUser(user);
        return user;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  static Future<String?> getUserId() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString('userId'); // or whatever key you use
    } catch (e) {
      return null;
    }
  }

  // Update profile
  static Future<Map<String, dynamic>> updateProfile({
    required String name,
    required String phone,
  }) async {
    try {
      final token = await getToken();
      final response = await ApiService.patch(
        '${ApiConfig.authEndpoint}/profile',
        body: {'name': name, 'phone': phone},
        token: token,
      );

      if (response['success']) {
        final user = UserModel.fromJson(response['user']);
        await _saveUser(user);
      }

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Update profile image
  static Future<Map<String, dynamic>> updateProfileImage({
    required String profileImage,
    String? cloudinaryId,
  }) async {
    try {
      final token = await getToken();
      final response = await ApiService.patch(
        '${ApiConfig.authEndpoint}/profile-image',
        body: {
          'profileImage': profileImage,
          if (cloudinaryId != null) 'cloudinaryId': cloudinaryId,
        },
        token: token,
      );

      if (response['success']) {
        final user = UserModel.fromJson(response['user']);
        await _saveUser(user);
      }

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Send OTP for password reset
  static Future<Map<String, dynamic>> forgotPassword({
    required String email,
  }) async {
    try {
      final response = await ApiService.post(
        '${ApiConfig.authEndpoint}/forgot-password',
        body: {'email': email},
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Reset password with OTP
  static Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    try {
      final response = await ApiService.post(
        '${ApiConfig.authEndpoint}/reset-password',
        body: {'email': email, 'otp': otp, 'newPassword': newPassword},
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Change password (for logged in users)
  static Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final token = await getToken();
      final response = await ApiService.post(
        '${ApiConfig.authEndpoint}/change-password',
        body: {'currentPassword': currentPassword, 'newPassword': newPassword},
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Update notification settings
  static Future<Map<String, dynamic>> updateNotificationSettings({
    required bool email,
    required bool push,
    required bool sms,
  }) async {
    try {
      final token = await getToken();
      final response = await ApiService.patch(
        '${ApiConfig.authEndpoint}/notification-settings',
        body: {'email': email, 'push': push, 'sms': sms},
        token: token,
      );
      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Update language
  static Future<Map<String, dynamic>> updateLanguage({
    required String language,
  }) async {
    try {
      final token = await getToken();
      final response = await ApiService.patch(
        '${ApiConfig.authEndpoint}/language',
        body: {'language': language},
        token: token,
      );
      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Save auth data
  static Future<void> _saveAuthData({
    required String token,
    required UserModel user,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
  }

  // Save user
  static Future<void> _saveUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
  }

  // Get token
  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  // Get saved user
  static Future<UserModel?> getSavedUser() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final userString = prefs.getString(_userKey);
      if (userString != null) {
        return UserModel.fromJson(jsonDecode(userString));
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // Check if logged in
  static Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null;
  }

  // Logout
  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }
}
