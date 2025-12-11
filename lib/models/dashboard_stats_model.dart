class DashboardStatsModel {
  final CourseStats courses;
  final StudentStats students;
  final AppointmentStats appointments;
  final RatingStats rating;
  final RevenueStats revenue;

  DashboardStatsModel({
    required this.courses,
    required this.students,
    required this.appointments,
    required this.rating,
    required this.revenue,
  });

  factory DashboardStatsModel.fromJson(Map<String, dynamic> json) {
    try {
      return DashboardStatsModel(
        courses: CourseStats.fromJson(json['courses'] ?? {}),
        students: StudentStats.fromJson(json['students'] ?? {}),
        appointments: AppointmentStats.fromJson(json['appointments'] ?? {}),
        rating: RatingStats.fromJson(json['rating'] ?? {}),
        revenue: RevenueStats.fromJson(json['revenue'] ?? {}),
      );
    } catch (e) {
      print('❌ Error parsing DashboardStatsModel: $e');
      rethrow;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'courses': courses.toJson(),
      'students': students.toJson(),
      'appointments': appointments.toJson(),
      'rating': rating.toJson(),
      'revenue': revenue.toJson(),
    };
  }
}

class CourseStats {
  final int total;
  final int published;
  final int draft;

  CourseStats({
    required this.total,
    required this.published,
    required this.draft,
  });

  factory CourseStats.fromJson(Map<String, dynamic> json) {
    return CourseStats(
      total: json['total'] ?? 0,
      published: json['published'] ?? 0,
      draft: json['draft'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'total': total,
      'published': published,
      'draft': draft,
    };
  }
}

class StudentStats {
  final int total;
  final int recentEnrollments;

  StudentStats({
    required this.total,
    required this.recentEnrollments,
  });

  factory StudentStats.fromJson(Map<String, dynamic> json) {
    return StudentStats(
      total: json['total'] ?? 0,
      recentEnrollments: json['recentEnrollments'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'total': total,
      'recentEnrollments': recentEnrollments,
    };
  }
}

class AppointmentStats {
  final int total;
  final int upcoming;
  final int completed;

  AppointmentStats({
    required this.total,
    required this.upcoming,
    required this.completed,
  });

  factory AppointmentStats.fromJson(Map<String, dynamic> json) {
    return AppointmentStats(
      total: json['total'] ?? 0,
      upcoming: json['upcoming'] ?? 0,
      completed: json['completed'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'total': total,
      'upcoming': upcoming,
      'completed': completed,
    };
  }
}

class RatingStats {
  final double average;
  final int totalReviews;

  RatingStats({
    required this.average,
    required this.totalReviews,
  });

  factory RatingStats.fromJson(Map<String, dynamic> json) {
    return RatingStats(
      average: (json['average'] ?? 0).toDouble(),
      totalReviews: json['totalReviews'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'average': average,
      'totalReviews': totalReviews,
    };
  }
}

class RevenueStats {
  final double total;

  RevenueStats({required this.total});

  factory RevenueStats.fromJson(Map<String, dynamic> json) {
    return RevenueStats(
      total: (json['total'] ?? 0).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'total': total,
    };
  }
}

// ✅ Activity Models (for Recent Activities)
class ActivityModel {
  final List<EnrollmentActivity> enrollments;
  final List<AppointmentActivity> appointments;

  ActivityModel({
    required this.enrollments,
    required this.appointments,
  });

  factory ActivityModel.fromJson(Map<String, dynamic> json) {
    return ActivityModel(
      enrollments: (json['enrollments'] as List?)
              ?.map((e) => EnrollmentActivity.fromJson(e))
              .toList() ??
          [],
      appointments: (json['appointments'] as List?)
              ?.map((a) => AppointmentActivity.fromJson(a))
              .toList() ??
          [],
    );
  }
}

class EnrollmentActivity {
  final String studentName;
  final String studentImage;
  final String courseName;
  final DateTime enrolledAt;

  EnrollmentActivity({
    required this.studentName,
    required this.studentImage,
    required this.courseName,
    required this.enrolledAt,
  });

  factory EnrollmentActivity.fromJson(Map<String, dynamic> json) {
    return EnrollmentActivity(
      studentName: json['studentId']?['name'] ?? 'Unknown',
      studentImage: json['studentId']?['profileImage'] ??
          'https://via.placeholder.com/150',
      courseName: json['courseId']?['title'] ?? 'Unknown Course',
      enrolledAt: json['enrolledAt'] != null
          ? DateTime.parse(json['enrolledAt'])
          : DateTime.now(),
    );
  }
}

class AppointmentActivity {
  final String studentName;
  final String studentImage;
  final DateTime dateTime;
  final String status;

  AppointmentActivity({
    required this.studentName,
    required this.studentImage,
    required this.dateTime,
    required this.status,
  });

  factory AppointmentActivity.fromJson(Map<String, dynamic> json) {
    return AppointmentActivity(
      studentName: json['studentId']?['name'] ?? 'Unknown',
      studentImage: json['studentId']?['profileImage'] ??
          'https://via.placeholder.com/150',
      dateTime: json['dateTime'] != null
          ? DateTime.parse(json['dateTime'])
          : DateTime.now(),
      status: json['status'] ?? 'pending',
    );
  }
}

// ✅ Earnings Models
class EarningsModel {
  final List<CourseEarning> byCourse;
  final List<MonthlyEarning> monthly;
  final double total;

  EarningsModel({
    required this.byCourse,
    required this.monthly,
    required this.total,
  });

  factory EarningsModel.fromJson(Map<String, dynamic> json) {
    return EarningsModel(
      byCourse: (json['byCourse'] as List?)
              ?.map((c) => CourseEarning.fromJson(c))
              .toList() ??
          [],
      monthly: (json['monthly'] as List?)
              ?.map((m) => MonthlyEarning.fromJson(m))
              .toList() ??
          [],
      total: (json['total'] ?? 0).toDouble(),
    );
  }
}

class CourseEarning {
  final String courseId;
  final String title;
  final int enrollments;
  final double price;
  final double totalEarnings;

  CourseEarning({
    required this.courseId,
    required this.title,
    required this.enrollments,
    required this.price,
    required this.totalEarnings,
  });

  factory CourseEarning.fromJson(Map<String, dynamic> json) {
    return CourseEarning(
      courseId: json['courseId'] ?? '',
      title: json['title'] ?? '',
      enrollments: json['enrollments'] ?? 0,
      price: (json['price'] ?? 0).toDouble(),
      totalEarnings: (json['totalEarnings'] ?? 0).toDouble(),
    );
  }
}

class MonthlyEarning {
  final DateTime month;
  final double earnings;

  MonthlyEarning({
    required this.month,
    required this.earnings,
  });

  factory MonthlyEarning.fromJson(Map<String, dynamic> json) {
    return MonthlyEarning(
      month: json['month'] != null
          ? DateTime.parse(json['month'])
          : DateTime.now(),
      earnings: (json['earnings'] ?? 0).toDouble(),
    );
  }
}