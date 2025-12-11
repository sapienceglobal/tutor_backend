import 'package:my_app/models/course_model.dart';

class EnrollmentModel {
  final String id;
  final String studentId;
  final CourseModel course;
  final DateTime enrolledAt;
  final EnrollmentProgress progress; // ✅ NEW
  final String status; // 'active', 'completed', 'dropped'
  final DateTime lastAccessed;
  final DateTime? completedAt;

  EnrollmentModel({
    required this.id,
    required this.studentId,
    required this.course,
    required this.enrolledAt,
    required this.progress,
    required this.status,
    required this.lastAccessed,
    this.completedAt,
  });

  factory EnrollmentModel.fromJson(Map<String, dynamic> json) {
    return EnrollmentModel(
      id: json['_id'] ?? '',
      studentId: json['studentId'] ?? '',
      course: CourseModel.fromJson(json['courseId'] ?? {}),
      enrolledAt: DateTime.parse(
        json['enrolledAt'] ?? DateTime.now().toIso8601String(),
      ),
      progress: EnrollmentProgress.fromJson(json['progress'] ?? {}),
      status: json['status'] ?? 'active',
      lastAccessed: DateTime.parse(
        json['lastAccessed'] ?? DateTime.now().toIso8601String(),
      ),
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'studentId': studentId,
      'courseId': course.toJson(),
      'enrolledAt': enrolledAt.toIso8601String(),
      'progress': progress.toJson(),
      'status': status,
      'lastAccessed': lastAccessed.toIso8601String(),
      'completedAt': completedAt?.toIso8601String(),
    };
  }
}

// ✅ NEW: EnrollmentProgress Class
class EnrollmentProgress {
  final List<String> completedLessons;
  final int percentage; // 0-100

  EnrollmentProgress({
    required this.completedLessons,
    required this.percentage,
  });

  factory EnrollmentProgress.fromJson(Map<String, dynamic> json) {
    return EnrollmentProgress(
      completedLessons: json['completedLessons'] != null
          ? List<String>.from(
              json['completedLessons'].map((x) => x.toString()),
            )
          : [],
      percentage: (json['percentage'] ?? 0).toInt(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'completedLessons': completedLessons,
      'percentage': percentage,
    };
  }
}