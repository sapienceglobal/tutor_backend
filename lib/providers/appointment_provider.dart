import 'package:flutter/material.dart';
import '../models/appointment_model.dart';
import '../services/appointment_service.dart';

class AppointmentProvider with ChangeNotifier {
  List<AppointmentModel> _appointments = [];
  bool _isLoading = false;
  String? _error;

  List<AppointmentModel> get appointments => _appointments;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Fetch my appointments
  Future<void> fetchMyAppointments({String? status}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
     
      _appointments = await AppointmentService.getMyAppointments(status: status);
      
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Create appointment
  Future<bool> createAppointment({
    required String tutorId,
    required DateTime dateTime,
    int duration = 60,
    String notes = '',
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await AppointmentService.createAppointment(
        tutorId: tutorId,
        dateTime: dateTime,
        duration: duration,
        notes: notes,
      );

      if (response['success']) {
        await fetchMyAppointments();
        _isLoading = false;
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Update appointment
  Future<bool> updateAppointment({
    required String id,
    String? status,
    DateTime? dateTime,
    String? notes,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
  
    try {
      final response = await AppointmentService.updateAppointment(
        id: id,
        status: status,
        dateTime: dateTime,
        notes: notes,
      );

      if (response['success']) {
        await fetchMyAppointments();
        _isLoading = false;
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Cancel appointment
  Future<bool> cancelAppointment(String id) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await AppointmentService.cancelAppointment(id);

      if (response['success']) {
        await fetchMyAppointments();
        _isLoading = false;
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Get upcoming appointments
  List<AppointmentModel> get upcomingAppointments {
    return _appointments
        .where((apt) =>
            apt.dateTime.isAfter(DateTime.now()) &&
            (apt.status == 'pending' || apt.status == 'confirmed'))
        .toList()
      ..sort((a, b) => a.dateTime.compareTo(b.dateTime));
  }

  // Get past appointments
  List<AppointmentModel> get pastAppointments {
    return _appointments
        .where((apt) =>
            apt.dateTime.isBefore(DateTime.now()) ||
            apt.status == 'completed' ||
            apt.status == 'cancelled')
        .toList()
      ..sort((a, b) => b.dateTime.compareTo(a.dateTime));
  }

  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}