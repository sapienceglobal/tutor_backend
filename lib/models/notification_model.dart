class NotificationModel {
  final String id;
  final String userId;
  final String type;
  final String title;
  final String message;
  final NotificationData? data;
  final bool isRead;
  final DateTime? readAt;
  final DateTime createdAt;

  NotificationModel({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    required this.message,
    this.data,
    required this.isRead,
    this.readAt,
    required this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['_id'] ?? '',
      userId: json['userId'] ?? '',
      type: json['type'] ?? '',
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      data: json['data'] != null
          ? NotificationData.fromJson(json['data'])
          : null,
      isRead: json['isRead'] ?? false,
      readAt: json['readAt'] != null ? DateTime.parse(json['readAt']) : null,
      createdAt: DateTime.parse(
        json['createdAt'] ?? DateTime.now().toIso8601String(),
      ),
    );
  }
}

class NotificationData {
  final String? courseId;
  final String? lessonId;
  final Map<String, dynamic>? extras;

  NotificationData({
    this.courseId,
    this.lessonId,
    this.extras,
  });

  factory NotificationData.fromJson(Map<String, dynamic> json) {
    return NotificationData(
      courseId: json['courseId']?['_id'],
      lessonId: json['lessonId']?['_id'],
      extras: json['extras'],
    );
  }
}