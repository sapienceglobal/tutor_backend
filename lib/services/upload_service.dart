import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:my_app/config/api_config.dart';
import 'dart:convert';
import 'api_service.dart'; // Yahan se API Key constant le lenge
import 'auth_service.dart';

class UploadService {
  static const String _endpoint = '/upload';

  // Upload single file
 // upload_service.dart

static Future<Map<String, dynamic>> uploadFile(File file) async {
  try {
    final token = await AuthService.getToken();
    
    // URL Check
    final uri = Uri.parse('${ApiConfig.baseUrl}/api/upload/image'); 
    
    final request = http.MultipartRequest('POST', uri);

    // --- CRITICAL FIX: HARDCODED KEY ---
    // Variable use mat karein, direct string likhein check karne ke liye
    // Make sure ye wahi key hai jo .env me hai
    String myApiKey = "bumpicare_flutter_2025_secure_key_xyz123abc456";

    // Headers set karne ka safe tarika
    request.headers.addAll({
      'Authorization': 'Bearer $token',
      'x-api-key': myApiKey, 
    });

    // --- DEBUG PRINT (Flutter Console me ye dekhna zaroori hai) ---
    print("--------------------------------------------------");
    print("🛠️ FLUTTER DEBUG: Sending Request to $uri");
    print("🛠️ FLUTTER DEBUG: Headers Map: ${request.headers}");
    print("--------------------------------------------------");

    request.files.add(
      await http.MultipartFile.fromPath('file', file.path),
    );

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    final data = json.decode(response.body);

    print("📥 Server Response Code: ${response.statusCode}");
    print("📥 Server Response Body: ${response.body}");

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data;
    } else {
      throw Exception(data['message'] ?? 'Upload failed');
    }
  } catch (e) {
    print("❌ Exception in Upload: $e");
    throw Exception(e.toString());
  }
}

  // Same fix for uploadMultipleFiles
  static Future<Map<String, dynamic>> uploadMultipleFiles(
    List<File> files,
  ) async {
    try {
      final token = await AuthService.getToken();
      final uri = Uri.parse('${ApiConfig.baseUrl}$_endpoint/multiple');

      final request = http.MultipartRequest('POST', uri);

      // --- FIX HERE ALSO ---
      request.headers['Authorization'] = 'Bearer $token';
      request.headers['x-api-key'] = ApiService.apiKey;
      // ---------------------

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
