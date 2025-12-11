class ProgressModel {
  final String id;
  final String studentId;
  final String courseId;
  final String lessonId;
  final bool completed;
  final int timeSpent;
  final int lastWatchedPosition;
  final DateTime? completedAt;
  final DateTime createdAt;

  ProgressModel({
    required this.id,
    required this.studentId,
    required this.courseId,
    required this.lessonId,
    this.completed = false,
    this.timeSpent = 0,
    this.lastWatchedPosition = 0,
    this.completedAt,
    required this.createdAt,
  });

  factory ProgressModel.fromJson(Map<String, dynamic> json) {
    return ProgressModel(
      id: json['_id'] ?? '',
      studentId: json['studentId'] ?? '',
      courseId: json['courseId'] ?? '',
      lessonId: json['lessonId'] ?? '',
      completed: json['completed'] ?? false,
      timeSpent: json['timeSpent'] ?? 0,
      lastWatchedPosition: json['lastWatchedPosition'] ?? 0,
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'])
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'studentId': studentId,
      'courseId': courseId,
      'lessonId': lessonId,
      'completed': completed,
      'timeSpent': timeSpent,
      'lastWatchedPosition': lastWatchedPosition,
      'completedAt': completedAt?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
    };
  }
}