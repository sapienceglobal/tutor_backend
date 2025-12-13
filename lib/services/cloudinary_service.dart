import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart'; // Ensure this is in pubspec.yaml
import 'dart:convert';
import 'auth_service.dart';
import '../config/api_config.dart';

class CloudinaryService {
  // 🔑 API Key yahan define kar di hai taaki headers me bhej sakein
  static const String _apiKey = "bumpicare_flutter_2025_secure_key_xyz123abc456"; 

  // Backend endpoint structure based on your server.js
  // server.js: app.use('/api/upload', ...)
  // router: router.post('/image', ...)
  static const String _baseUrl = '/upload'; 

  // ---------------------------------------------------------------------------
  // 1. UPLOAD SINGLE IMAGE
  // ---------------------------------------------------------------------------
  static Future<Map<String, dynamic>?> uploadImage(File imageFile) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        print('❌ No auth token found');
        return null;
      }

      // URL Construction: BaseUrl + /api/upload + /image
      final uri = Uri.parse('${ApiConfig.baseUrl}$_baseUrl/image');
      
      final request = http.MultipartRequest('POST', uri);

      // --- CRITICAL FIX: Add API Key & Token ---
      request.headers.addAll({
        'Authorization': 'Bearer $token',
        'x-api-key': _apiKey, // Ye missing tha pehle
      });

      // Detect MIME Type
      String mimeType = 'jpeg';
      String extension = imageFile.path.split('.').last.toLowerCase();
      
      if (extension == 'png') mimeType = 'png';
      if (extension == 'webp') mimeType = 'webp';

      // Add File
      request.files.add(
        await http.MultipartFile.fromPath(
          'file', 
          imageFile.path,
          contentType: MediaType('image', mimeType),
        ),
      );

      // print('--------------------------------------------------');
      // print('📤 Uploading Single Image to: $uri');
      // print('🔑 Headers: ${request.headers}');
      // print('--------------------------------------------------');

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      // print('📥 Response Status: ${response.statusCode}');

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final jsonData = jsonDecode(response.body);
        // print('✅ Upload successful: ${jsonData['url']}');
        return {
          'url': jsonData['url'],
          'publicId': jsonData['publicId'],
        };
      } else {
        print('❌ Upload failed: ${response.body}');
        return null;
      }
    } catch (e) {
      print('❌ Upload Exception: $e');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. UPLOAD MULTIPLE FILES
  // ---------------------------------------------------------------------------
  static Future<List<Map<String, dynamic>>?> uploadMultipleFiles(List<File> files) async {
    try {
      final token = await AuthService.getToken();
      
      // Note: Make sure backend has '/api/upload/multiple' route
      final uri = Uri.parse('${ApiConfig.baseUrl}$_baseUrl/multiple');

      final request = http.MultipartRequest('POST', uri);

      request.headers.addAll({
        'Authorization': 'Bearer $token',
        'x-api-key': _apiKey,
      });

      for (var file in files) {
        String mimeType = 'jpeg';
        if (file.path.endsWith('.png')) mimeType = 'png';
        
        request.files.add(
          await http.MultipartFile.fromPath(
            'files', // Backend array name usually 'files' or 'images'
            file.path,
            contentType: MediaType('image', mimeType),
          ),
        );
      }

      print('📤 Uploading ${files.length} files...');
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        // Assuming backend returns { urls: [...] } or similar list
        return List<Map<String, dynamic>>.from(data['data'] ?? []);
      } else {
        print('❌ Multiple Upload failed: ${response.body}');
        return null;
      }
    } catch (e) {
      print('❌ Error: $e');
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. DELETE IMAGE
  // ---------------------------------------------------------------------------
  static Future<bool> deleteImage(String publicId) async {
    try {
      final token = await AuthService.getToken();
      
      // Backend Delete Route: DELETE /api/upload/image
      final uri = Uri.parse('${ApiConfig.baseUrl}$_baseUrl/image');

      print('🗑️ Deleting Image: $publicId');

      // Use generic HTTP Request because standard http.delete body support varies
      final request = http.Request('DELETE', uri);
      
      request.headers.addAll({
        'Authorization': 'Bearer $token',
        'x-api-key': _apiKey,
        'Content-Type': 'application/json',
      });

      request.body = jsonEncode({'publicId': publicId});

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        print('✅ Image deleted successfully');
        return true;
      } else {
        print('❌ Delete failed: ${response.body}');
        return false;
      }
    } catch (e) {
      print('❌ Delete Exception: $e');
      return false;
    }
  }
}