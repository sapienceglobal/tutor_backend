// lib/providers/schedule_provider.dart

import 'package:flutter/material.dart';
import '../services/appointment_service.dart';
import '../models/schedule_models.dart';

class ScheduleProvider with ChangeNotifier {
  bool isLoading = false;
  String? errorMessage;
  
  // Weekly Template
  Map<String, List<String>> weeklySlots = {};
  
  // Date Overrides
  List<DateOverride> dateOverrides = [];
  
  // Booking Settings
  BookingSettings bookingSettings = BookingSettings();

  // Full schedule object
  TutorSchedule? get tutorSchedule {
    if (weeklySlots.isEmpty) return null;
    return TutorSchedule(
      tutorId: '',
      weeklySlots: weeklySlots,
      dateOverrides: dateOverrides,
      bookingSettings: bookingSettings,
    );
  }

  // ==================== WEEKLY TEMPLATE ====================

  bool _hasOverlap(List<String> slots, String newSlot) {
    final [newStart, newEnd] = newSlot.split('-');
    
    for (var slot in slots) {
      final [start, end] = slot.split('-');
      if (newStart.compareTo(end) < 0 && start.compareTo(newEnd) < 0) {
        return true;
      }
    }
    return false;
  }

  String? setDaySlot(String day, String slot) {
    weeklySlots.putIfAbsent(day, () => []);

    if (weeklySlots[day]!.contains(slot)) {
      return "This slot already exists";
    }

    if (_hasOverlap(weeklySlots[day]!, slot)) {
      return "This slot overlaps with an existing slot";
    }

    weeklySlots[day]!.add(slot);
    weeklySlots[day]!.sort();
    notifyListeners();
    return null;
  }

  void removeSlot(String day, String slot) {
    weeklySlots[day]?.remove(slot);

    if (weeklySlots[day]?.isEmpty ?? false) {
      weeklySlots.remove(day);
    }
    notifyListeners();
  }

  void clearDay(String day) {
    weeklySlots.remove(day);
    notifyListeners();
  }

  void clearAll() {
    weeklySlots.clear();
    dateOverrides.clear();
    notifyListeners();
  }

  List<Map<String, dynamic>> get apiFormat => weeklySlots.entries
      .map((e) => {
            "day": e.key,
            "slots": e.value,
          })
      .toList();

  Future<void> loadSchedule(String tutorId) async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      final response = await AppointmentService.getSchedule(tutorId);

      weeklySlots = {
        for (var s in response['schedule']) 
          s['day'] as String: List<String>.from(s['slots'])
      };

      // Load date overrides
      if (response['dateOverrides'] != null) {
        dateOverrides = (response['dateOverrides'] as List)
            .map((e) => DateOverride.fromJson(e))
            .toList();
      }

      // Load booking settings
      if (response['bookingSettings'] != null) {
        bookingSettings = BookingSettings.fromJson(response['bookingSettings']);
      }

      isLoading = false;
      notifyListeners();
    } catch (e) {
      isLoading = false;
      errorMessage = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> saveSchedule() async {
    if (weeklySlots.isEmpty) {
      throw Exception("No slots to save");
    }

    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      await AppointmentService.updateSchedule(apiFormat);

      isLoading = false;
      notifyListeners();
    } catch (e) {
      isLoading = false;
      errorMessage = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> deleteDay(String day) async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      await AppointmentService.deleteDay(day);
      weeklySlots.remove(day);

      isLoading = false;
      notifyListeners();
    } catch (e) {
      isLoading = false;
      errorMessage = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  // ==================== DATE OVERRIDES ====================

  Future<void> blockDate(String date, {String? reason}) async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      await AppointmentService.blockDate(date, reason: reason);

      // Update local state
      dateOverrides.removeWhere((o) => o.date == date);
      dateOverrides.add(DateOverride(
        date: date,
        isBlocked: true,
        reason: reason,
      ));

      isLoading = false;
      notifyListeners();
    } catch (e) {
      isLoading = false;
      errorMessage = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> unblockDate(String date) async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      await AppointmentService.unblockDate(date);

      // Update local state
      dateOverrides.removeWhere((o) => o.date == date);

      isLoading = false;
      notifyListeners();
    } catch (e) {
      isLoading = false;
      errorMessage = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  Future<void> setCustomSlots(
    String date,
    List<String> slots, {
    String? reason,
  }) async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      await AppointmentService.setCustomSlots(date, slots, reason: reason);

      // Update local state
      dateOverrides.removeWhere((o) => o.date == date);
      dateOverrides.add(DateOverride(
        date: date,
        isBlocked: false,
        customSlots: slots,
        reason: reason,
      ));

      isLoading = false;
      notifyListeners();
    } catch (e) {
      isLoading = false;
      errorMessage = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  // ==================== BOOKING SETTINGS ====================

  Future<void> updateBookingSettings(BookingSettings settings) async {
    try {
      isLoading = true;
      errorMessage = null;
      notifyListeners();

      await AppointmentService.updateBookingSettings(settings);

      bookingSettings = settings;

      isLoading = false;
      notifyListeners();
    } catch (e) {
      isLoading = false;
      errorMessage = e.toString();
      notifyListeners();
      rethrow;
    }
  }

  // ==================== HELPER METHODS ====================

  bool isDateAvailable(DateTime date) {
    return tutorSchedule?.isDateAvailable(date) ?? false;
  }

  List<String> getSlotsForDate(DateTime date) {
    return tutorSchedule?.getSlotsForDate(date) ?? [];
  }

  bool isDateBlocked(DateTime date) {
    return tutorSchedule?.isDateBlocked(date) ?? false;
  }

  bool hasCustomSlots(DateTime date) {
    return tutorSchedule?.hasCustomSlots(date) ?? false;
  }

  String formatDate(DateTime date) {
    return "${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}";
  }
}