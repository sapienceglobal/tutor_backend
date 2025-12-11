class UserModel {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String role;
  final String profileImage;
  final String? cloudinaryId;
  final String language;
  final NotificationSettings notificationSettings;
  final DateTime? createdAt;

  UserModel({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    required this.profileImage,
    this.cloudinaryId,
    this.language = 'en',
    required this.notificationSettings,
    this.createdAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['_id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      role: json['role'] ?? 'student',
      profileImage: json['profileImage'] ?? 'https://via.placeholder.com/150',
      cloudinaryId: json['cloudinaryId'],
      language: json['language'] ?? 'en',
      notificationSettings: json['notificationSettings'] != null
          ? NotificationSettings.fromJson(json['notificationSettings'])
          : NotificationSettings(email: true, push: true, sms: false),
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : null,
    );
  }
  factory UserModel.empty() {
    return UserModel(
      id: '',
      name: '',
      email: '',
      phone: '',
      role: 'student',
      profileImage: 'https://via.placeholder.com/150',
      cloudinaryId: null,
      language: 'en',
      notificationSettings: NotificationSettings(
        email: true,
        push: true,
        sms: false,
      ),
      createdAt: null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'email': email,
      'phone': phone,
      'role': role,
      'profileImage': profileImage,
      'cloudinaryId': cloudinaryId,
      'language': language,
      'notificationSettings': notificationSettings.toJson(),
      'createdAt': createdAt?.toIso8601String(),
    };
  }

  UserModel copyWith({
    String? id,
    String? name,
    String? email,
    String? phone,
    String? role,
    String? profileImage,
    String? cloudinaryId,
    String? language,
    NotificationSettings? notificationSettings,
    DateTime? createdAt,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      profileImage: profileImage ?? this.profileImage,
      cloudinaryId: cloudinaryId ?? this.cloudinaryId,
      language: language ?? this.language,
      notificationSettings: notificationSettings ?? this.notificationSettings,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

class NotificationSettings {
  final bool email;
  final bool push;
  final bool sms;

  NotificationSettings({
    required this.email,
    required this.push,
    required this.sms,
  });

  factory NotificationSettings.fromJson(Map<String, dynamic> json) {
    return NotificationSettings(
      email: json['email'] ?? true,
      push: json['push'] ?? true,
      sms: json['sms'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {'email': email, 'push': push, 'sms': sms};
  }

  NotificationSettings copyWith({bool? email, bool? push, bool? sms}) {
    return NotificationSettings(
      email: email ?? this.email,
      push: push ?? this.push,
      sms: sms ?? this.sms,
    );
  }
}
