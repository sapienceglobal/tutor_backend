import 'category_model.dart';
import 'tutor_model.dart';

class CourseModule {
  final String id;
  final String title;
  final String description;
  final int order;

  CourseModule({
    required this.id,
    required this.title,
    this.description = '',
    this.order = 0,
  });

  factory CourseModule.fromJson(Map<String, dynamic> json) {
    return CourseModule(
      id: json['_id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Untitled Module',
      description: json['description']?.toString() ?? '',
      order: json['order'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'title': title,
      'description': description,
      'order': order,
    };
  }
}

class CourseModel {
  final String id;
  final String title;
  final String description;
  final String thumbnail;
  final CategoryModel category;
  final TutorModel tutor;
  final double price;
  final bool isFree;
  final String level;
  final double duration;
  final String language;
  final List<CourseModule> modules;
  final int enrolledCount;
  final double rating;
  final int reviewCount;
  final String status;
  final List<String> requirements;
  final List<String> whatYouWillLearn;
  final DateTime createdAt;
  final DateTime updatedAt;

  CourseModel({
    required this.id,
    required this.title,
    required this.description,
    required this.thumbnail,
    required this.category,
    required this.tutor,
    this.price = 0,
    this.isFree = true,
    this.level = 'beginner',
    this.duration = 0,
    this.language = 'English',
    this.modules = const [],
    this.enrolledCount = 0,
    this.rating = 0,
    this.reviewCount = 0,
    this.status = 'published',
    this.requirements = const [],
    this.whatYouWillLearn = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  factory CourseModel.fromJson(Map<String, dynamic> json) {
    try {
      print('📦 Parsing CourseModel: ${json['title']}');

      // ✅ Parse Category
      CategoryModel category;
      try {
        if (json['categoryId'] != null) {
          category = CategoryModel.fromJson(json['categoryId'] is Map<String, dynamic>
              ? json['categoryId']
              : {'_id': json['categoryId'].toString(), 'name': 'Unknown', 'icon': '📚'});
        } else {
          category = CategoryModel(id: '', name: 'Unknown', icon: '📚');
        }
      } catch (e) {
        print('⚠️ Error parsing category, using default: $e');
        category = CategoryModel(id: '', name: 'Unknown', icon: '📚');
      }

      // ✅ Parse Tutor
      TutorModel tutor;
      try {
        if (json['tutorId'] != null) {
          tutor = TutorModel.fromJson(json['tutorId']);
        } else {
          throw Exception('tutorId is null');
        }
      } catch (e) {
        print('❌ Error parsing tutor: $e');
        print('TutorId data: ${json['tutorId']}');
        rethrow; // Stop here - tutor is required
      }

      // ✅ Parse Modules
      List<CourseModule> modules = [];
      try {
        if (json['modules'] != null && json['modules'] is List) {
          modules = (json['modules'] as List)
              .map((m) {
                try {
                  return CourseModule.fromJson(m);
                } catch (e) {
                  print('⚠️ Skipping invalid module: $e');
                  return null;
                }
              })
              .whereType<CourseModule>()
              .toList();
        }
      } catch (e) {
        print('⚠️ Error parsing modules: $e');
      }

      // ✅ Parse arrays safely
      List<String> parseStringList(dynamic data) {
        if (data == null) return [];
        if (data is List) {
          return data.map((item) => item.toString()).toList();
        }
        return [];
      }

      final course = CourseModel(
        id: json['_id']?.toString() ?? '',
        title: json['title']?.toString() ?? 'Untitled Course',
        description: json['description']?.toString() ?? '',
        thumbnail: json['thumbnail']?.toString() ?? 'https://via.placeholder.com/400x250',
        category: category,
        tutor: tutor,
        price: (json['price'] ?? 0).toDouble(),
        isFree: json['isFree'] ?? true,
        level: json['level']?.toString() ?? 'beginner',
        duration: (json['duration'] ?? 0).toDouble(),
        language: json['language']?.toString() ?? 'English',
        modules: modules,
        enrolledCount: json['enrolledCount'] ?? 0,
        rating: (json['rating'] ?? 0).toDouble(),
        reviewCount: json['reviewCount'] ?? 0,
        status: json['status']?.toString() ?? 'published',
        requirements: parseStringList(json['requirements']),
        whatYouWillLearn: parseStringList(json['whatYouWillLearn']),
        createdAt: json['createdAt'] != null
            ? DateTime.parse(json['createdAt'])
            : DateTime.now(),
        updatedAt: json['updatedAt'] != null
            ? DateTime.parse(json['updatedAt'])
            : DateTime.now(),
      );

      print('✅ CourseModel parsed successfully: ${course.title}');
      return course;
    } catch (e, stackTrace) {
      print('❌ FATAL: Error parsing CourseModel');
      print('Error: $e');
      print('StackTrace: $stackTrace');
      print('JSON: $json');
      rethrow;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'title': title,
      'description': description,
      'thumbnail': thumbnail,
      'categoryId': category.toJson(),
      'tutorId': tutor.toJson(),
      'price': price,
      'isFree': isFree,
      'level': level,
      'duration': duration,
      'language': language,
      'modules': modules.map((m) => m.toJson()).toList(),
      'enrolledCount': enrolledCount,
      'rating': rating,
      'reviewCount': reviewCount,
      'status': status,
      'requirements': requirements,
      'whatYouWillLearn': whatYouWillLearn,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}