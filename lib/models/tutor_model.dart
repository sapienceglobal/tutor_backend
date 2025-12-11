import 'user_model.dart';
import 'category_model.dart';

class TutorModel {
  final String id;
  final UserModel user;
  final CategoryModel category;
  final double hourlyRate;
  final int experience;
  final double rating;
  final int studentsCount;
  final List<String> subjects;
  final String bio;
  final bool isVerified;

  TutorModel({
    required this.id,
    required this.user,
    required this.category,
    required this.hourlyRate,
    required this.experience,
    this.rating = 0.0,
    this.studentsCount = 0,
    this.subjects = const [],
    this.bio = '',
    this.isVerified = false,
  });

  factory TutorModel.fromJson(Map<String, dynamic> json) {
    try {
      print('🔍 Parsing TutorModel: ${json['_id']}');

      // ✅ Parse userId (can be object or string)
      UserModel user;
      if (json['userId'] != null) {
        if (json['userId'] is Map<String, dynamic>) {
          user = UserModel.fromJson(json['userId']);
        } else if (json['userId'] is String) {
          user = UserModel(
            id: json['userId'].toString(),
            name: 'Unknown Tutor',
            email: 'unknown@example.com',
            phone: '',
            role: 'tutor',
            profileImage: 'https://via.placeholder.com/150',
            language: 'en',
            notificationSettings: NotificationSettings(
              email: true,
              push: true,
              sms: false,
            ),
          );
        } else {
          throw Exception('Invalid userId type: ${json['userId'].runtimeType}');
        }
      } else {
        throw Exception('userId is null');
      }

      // ✅ Parse categoryId (can be object or string)
      CategoryModel category;
      if (json['categoryId'] != null) {
        if (json['categoryId'] is Map<String, dynamic>) {
          category = CategoryModel.fromJson(json['categoryId']);
        } else if (json['categoryId'] is String) {
          category = CategoryModel(
            id: json['categoryId'].toString(),
            name: 'Unknown',
            icon: '📚',
          );
        } else {
          throw Exception('Invalid categoryId type: ${json['categoryId'].runtimeType}');
        }
      } else {
        throw Exception('categoryId is null');
      }

      // ✅ Parse subjects safely
      List<String> subjects = [];
      if (json['subjects'] != null && json['subjects'] is List) {
        subjects = (json['subjects'] as List)
            .map((item) => item.toString())
            .toList();
      }

      final tutor = TutorModel(
        id: json['_id']?.toString() ?? '',
        user: user,
        category: category,
        hourlyRate: (json['hourlyRate'] ?? 0).toDouble(),
        experience: json['experience'] ?? 0,
        rating: (json['rating'] ?? 0).toDouble(),
        studentsCount: json['studentsCount'] ?? 0,
        subjects: subjects,
        bio: json['bio']?.toString() ?? '',
        isVerified: json['isVerified'] ?? false,
      );

      print('✅ TutorModel parsed successfully');
      return tutor;
    } catch (e) {
      print('❌ Error parsing TutorModel: $e');
      print('JSON Data: $json');
      rethrow;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'userId': user.toJson(),
      'categoryId': category.toJson(),
      'hourlyRate': hourlyRate,
      'experience': experience,
      'rating': rating,
      'studentsCount': studentsCount,
      'subjects': subjects,
      'bio': bio,
      'isVerified': isVerified,
    };
  }
}