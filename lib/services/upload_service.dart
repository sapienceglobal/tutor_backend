import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:my_app/config/api_config.dart';
import 'dart:convert';
import 'api_service.dart';
import 'auth_service.dart';

class UploadService {
  static const String _endpoint = '/upload';

  // Upload single file
  static Future<Map<String, dynamic>> uploadFile(File file) async {
    try {
      final token = await AuthService.getToken();
      final uri = Uri.parse('${ApiConfig.baseUrl}$_endpoint/single');

      final request = http.MultipartRequest('POST', uri);
      request.headers['Authorization'] = 'Bearer $token';

      request.files.add(
        await http.MultipartFile.fromPath('file', file.path),
      );

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      final data = json.decode(response.body);

      return data;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Upload multiple files
  static Future<Map<String, dynamic>> uploadMultipleFiles(
      List<File> files) async {
    try {
      final token = await AuthService.getToken();
      final uri = Uri.parse('${ApiConfig.baseUrl}$_endpoint/multiple');

      final request = http.MultipartRequest('POST', uri);
      request.headers['Authorization'] = 'Bearer $token';

      for (var file in files) {
        request.files.add(
          await http.MultipartFile.fromPath('files', file.path),
        );
      }

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      final data = json.decode(response.body);

      return data;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Delete file
  static Future<Map<String, dynamic>> deleteFile(String publicId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.delete(
        '$_endpoint/$publicId',
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get file info
  static Future<Map<String, dynamic>> getFileInfo(String publicId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '$_endpoint/info/$publicId',
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }
}