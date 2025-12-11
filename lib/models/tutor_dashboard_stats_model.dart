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
    return DashboardStatsModel(
      courses: CourseStats.fromJson(json['courses'] ?? {}),
      students: StudentStats.fromJson(json['students'] ?? {}),
      appointments: AppointmentStats.fromJson(json['appointments'] ?? {}),
      rating: RatingStats.fromJson(json['rating'] ?? {}),
      revenue: RevenueStats.fromJson(json['revenue'] ?? {}),
    );
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
}

class RevenueStats {
  final double total;

  RevenueStats({required this.total});

  factory RevenueStats.fromJson(Map<String, dynamic> json) {
    return RevenueStats(
      total: (json['total'] ?? 0).toDouble(),
    );
  }
}