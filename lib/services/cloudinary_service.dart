import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart'; // MediaType ke liye
import 'dart:convert';
import 'auth_service.dart';
import '../config/api_config.dart';

class CloudinaryService {
  static Future<Map<String, dynamic>?> uploadImage(File imageFile) async {
    try {
      
      final token = await AuthService.getToken();
      if (token == null) {
        print('❌ No auth token found');
        return null;
      }

      final url = Uri.parse('${ApiConfig.baseUrl}/upload/image');
      final request = http.MultipartRequest('POST', url);

      // Add auth header
      request.headers['Authorization'] = 'Bearer $token';

      // Detect image type from file extension
      String mimeType = '';
      if (imageFile.path.endsWith('.png')) {
        mimeType = 'png';
      } else if (imageFile.path.endsWith('.jpg') || imageFile.path.endsWith('.jpeg')) {
        mimeType = 'jpeg';
      } else if (imageFile.path.endsWith('.webp')) {
        mimeType = 'webp';
      } else {
        mimeType = 'jpeg'; // default fallback
      }

      // Add image file with proper contentType
      request.files.add(
        await http.MultipartFile.fromPath(
          'file', // backend me multer me jo name expect ho, usually 'file'
          imageFile.path,
          contentType: MediaType('image', mimeType),
        ),
      );

      print('📤 Uploading image...');
      final response = await request.send();
      final body = await response.stream.bytesToString();

      print('📥 Response Status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final jsonData = jsonDecode(body);
        print('✅ Upload successful!');
        return {
          'url': jsonData['url'],
          'publicId': jsonData['publicId'],
        };
      } else {
        print('❌ Upload failed: $body');
        return null;
      }
    } catch (e) {
      print('❌ Upload error: $e');
      return null;
    }
  }
}
