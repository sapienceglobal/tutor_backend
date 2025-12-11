// lib/models/schedule_models.dart

class DateOverride {
  final String date; // "YYYY-MM-DD"
  final bool isBlocked;
  final String? reason;
  final List<String> customSlots;
  final DateTime? createdAt;

  DateOverride({
    required this.date,
    required this.isBlocked,
    this.reason,
    this.customSlots = const [],
    this.createdAt,
  });

  factory DateOverride.fromJson(Map<String, dynamic> json) {
    return DateOverride(
      date: json['date'] as String,
      isBlocked: json['isBlocked'] as bool? ?? false,
      reason: json['reason'] as String?,
      customSlots: json['customSlots'] != null
          ? List<String>.from(json['customSlots'])
          : [],
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'date': date,
      'isBlocked': isBlocked,
      if (reason != null) 'reason': reason,
      if (customSlots.isNotEmpty) 'customSlots': customSlots,
    };
  }

  DateOverride copyWith({
    String? date,
    bool? isBlocked,
    String? reason,
    List<String>? customSlots,
  }) {
    return DateOverride(
      date: date ?? this.date,
      isBlocked: isBlocked ?? this.isBlocked,
      reason: reason ?? this.reason,
      customSlots: customSlots ?? this.customSlots,
      createdAt: createdAt,
    );
  }
}

class BookingSettings {
  final int minAdvanceHours;
  final int maxAdvanceDays;
  final bool allowSameDayBooking;
  final int slotCapacity;
  final int bufferBetweenSlots;

  BookingSettings({
    this.minAdvanceHours = 24,
    this.maxAdvanceDays = 60,
    this.allowSameDayBooking = false,
    this.slotCapacity = 1,
    this.bufferBetweenSlots = 0,
  });

  factory BookingSettings.fromJson(Map<String, dynamic> json) {
    return BookingSettings(
      minAdvanceHours: json['minAdvanceHours'] as int? ?? 24,
      maxAdvanceDays: json['maxAdvanceDays'] as int? ?? 60,
      allowSameDayBooking: json['allowSameDayBooking'] as bool? ?? false,
      slotCapacity: json['slotCapacity'] as int? ?? 1,
      bufferBetweenSlots: json['bufferBetweenSlots'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'minAdvanceHours': minAdvanceHours,
      'maxAdvanceDays': maxAdvanceDays,
      'allowSameDayBooking': allowSameDayBooking,
      'slotCapacity': slotCapacity,
      'bufferBetweenSlots': bufferBetweenSlots,
    };
  }

  BookingSettings copyWith({
    int? minAdvanceHours,
    int? maxAdvanceDays,
    bool? allowSameDayBooking,
    int? slotCapacity,
    int? bufferBetweenSlots,
  }) {
    return BookingSettings(
      minAdvanceHours: minAdvanceHours ?? this.minAdvanceHours,
      maxAdvanceDays: maxAdvanceDays ?? this.maxAdvanceDays,
      allowSameDayBooking: allowSameDayBooking ?? this.allowSameDayBooking,
      slotCapacity: slotCapacity ?? this.slotCapacity,
      bufferBetweenSlots: bufferBetweenSlots ?? this.bufferBetweenSlots,
    );
  }

  DateTime get minBookingDate {
    return DateTime.now().add(Duration(hours: minAdvanceHours));
  }

  DateTime get maxBookingDate {
    return DateTime.now().add(Duration(days: maxAdvanceDays));
  }
}

class TutorSchedule {
  final String tutorId;
  final Map<String, List<String>> weeklySlots;
  final List<DateOverride> dateOverrides;
  final BookingSettings bookingSettings;

  TutorSchedule({
    required this.tutorId,
    required this.weeklySlots,
    this.dateOverrides = const [],
    required this.bookingSettings,
  });

  // Check if a date is available for booking
  bool isDateAvailable(DateTime date) {
    final dateStr = _formatDate(date);

    // Check if date is blocked
    final override = dateOverrides.firstWhere(
      (o) => o.date == dateStr,
      orElse: () => DateOverride(date: dateStr, isBlocked: false),
    );

    if (override.isBlocked) return false;

    // Check booking window
    if (date.isBefore(bookingSettings.minBookingDate) ||
        date.isAfter(bookingSettings.maxBookingDate)) {
      return false;
    }

    return true;
  }

  // Get available slots for a specific date
  List<String> getSlotsForDate(DateTime date) {
    final dateStr = _formatDate(date);

    // Check for date-specific override first
    final override = dateOverrides.firstWhere(
      (o) => o.date == dateStr,
      orElse: () => DateOverride(date: dateStr, isBlocked: false),
    );

    if (override.isBlocked) return [];
    if (override.customSlots.isNotEmpty) return override.customSlots;

    // Otherwise use weekly template
    final dayName = _getDayName(date);
    return weeklySlots[dayName] ?? [];
  }

  // Check if a date has custom slots
  bool hasCustomSlots(DateTime date) {
    final dateStr = _formatDate(date);
    final override = dateOverrides.firstWhere(
      (o) => o.date == dateStr,
      orElse: () => DateOverride(date: dateStr, isBlocked: false),
    );
    return override.customSlots.isNotEmpty;
  }

  // Check if a date is blocked
  bool isDateBlocked(DateTime date) {
    final dateStr = _formatDate(date);
    final override = dateOverrides.firstWhere(
      (o) => o.date == dateStr,
      orElse: () => DateOverride(date: dateStr, isBlocked: false),
    );
    return override.isBlocked;
  }

  String _formatDate(DateTime date) {
    return "${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}";
  }

  String _getDayName(DateTime date) {
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ];
    return days[date.weekday - 1];
  }
}