import '../models/appointment_model.dart';
import 'api_service.dart';
import 'auth_service.dart';
import '../config/api_config.dart';
import '../models/schedule_models.dart';

class AppointmentService {
  // Get my appointments
  static Future<List<AppointmentModel>> getMyAppointments({
    String? status,
  }) async {
    try {
      final token = await AuthService.getToken();

      Map<String, String>? queryParams;
      if (status != null) {
        queryParams = {'status': status};
      }

      final response = await ApiService.get(
        ApiConfig.appointmentsEndpoint,
        token: token,
        queryParams: queryParams,
      );

      if (response['success']) {
        final List<dynamic> appointmentsJson = response['appointments'];
        return appointmentsJson
            .map((json) => AppointmentModel.fromJson(json))
            .toList();
      }
      return [];
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get appointment by ID
  static Future<AppointmentModel?> getAppointmentById(String id) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '${ApiConfig.appointmentsEndpoint}/$id',
        token: token,
      );

      if (response['success']) {
        return AppointmentModel.fromJson(response['appointment']);
      }
      return null;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Create appointment
  static Future<Map<String, dynamic>> createAppointment({
    required String tutorId,
    required DateTime dateTime,
    int duration = 60,
    String notes = '',
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        ApiConfig.appointmentsEndpoint,
        body: {
          'tutorId': tutorId,
          'dateTime': dateTime.toIso8601String(),
          'duration': duration,
          'notes': notes,
        },
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Update appointment
  static Future<Map<String, dynamic>> updateAppointment({
    required String id,
    String? status,
    DateTime? dateTime,
    String? notes,
  }) async {
    try {
      final token = await AuthService.getToken();

      Map<String, dynamic> body = {};
      if (status != null) body['status'] = status;
      if (dateTime != null) body['dateTime'] = dateTime.toIso8601String();
      if (notes != null) body['notes'] = notes;

      final response = await ApiService.patch(
        '${ApiConfig.appointmentsEndpoint}/$id',
        body: body,
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Cancel appointment
  static Future<Map<String, dynamic>> cancelAppointment(String id) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.delete(
        '${ApiConfig.appointmentsEndpoint}/$id',
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // SCHEDULE SYSTEM
  // -------------------------------------------------------------------

  // Get tutor schedule (Enhanced)
  static Future<Map<String, dynamic>> getSchedule(String tutorId) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '${ApiConfig.appointmentsEndpoint}/schedule/$tutorId',
        token: token,
      );

      if (response['success']) {
        return {
          'schedule': response['schedule'] ?? [],
          'dateOverrides': response['dateOverrides'] ?? [],
          'bookingSettings': response['bookingSettings'] ?? {},
        };
      }

      return {'schedule': [], 'dateOverrides': [], 'bookingSettings': {}};
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Update schedule (POST)
  static Future<Map<String, dynamic>> updateSchedule(
    List<Map<String, dynamic>> availability,
  ) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        '${ApiConfig.appointmentsEndpoint}/schedule',
        body: {"availability": availability},
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Delete schedule for a specific day
  static Future<Map<String, dynamic>> deleteDay(String day) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.delete(
        '${ApiConfig.appointmentsEndpoint}/schedule/$day',
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // ==================== DATE OVERRIDES ====================

  // Block a specific date
  static Future<Map<String, dynamic>> blockDate(
    String date, {
    String? reason,
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        '${ApiConfig.appointmentsEndpoint}/schedule/block-date',
        body: {"date": date, if (reason != null) "reason": reason},
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Unblock a date
  static Future<Map<String, dynamic>> unblockDate(String date) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.delete(
        '${ApiConfig.appointmentsEndpoint}/schedule/unblock-date/$date',
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Set custom slots for a specific date
  static Future<Map<String, dynamic>> setCustomSlots(
    String date,
    List<String> slots, {
    String? reason,
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.post(
        '${ApiConfig.appointmentsEndpoint}/schedule/custom-slots',
        body: {
          "date": date,
          "slots": slots,
          if (reason != null) "reason": reason,
        },
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // Get date overrides
  static Future<List<DateOverride>> getDateOverrides(
    String tutorId, {
    String? startDate,
    String? endDate,
  }) async {
    try {
      final token = await AuthService.getToken();

      String url =
          '${ApiConfig.appointmentsEndpoint}/schedule/overrides/$tutorId';

      if (startDate != null && endDate != null) {
        url += '?startDate=$startDate&endDate=$endDate';
      }

      final response = await ApiService.get(url, token: token);

      if (response['success']) {
        return (response['dateOverrides'] as List)
            .map((e) => DateOverride.fromJson(e))
            .toList();
      }

      return [];
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // ==================== BOOKING SETTINGS ====================

  // Update booking settings
  static Future<Map<String, dynamic>> updateBookingSettings(
    BookingSettings settings,
  ) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.put(
        '${ApiConfig.appointmentsEndpoint}/schedule/booking-settings',
        body: settings.toJson(),
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }

  // ==================== AVAILABILITY CHECK ====================

  // Check if a slot is available
  static Future<Map<String, dynamic>> checkSlotAvailability({
    required String tutorId,
    required String date,
    required String slot,
  }) async {
    try {
      final token = await AuthService.getToken();

      final response = await ApiService.get(
        '${ApiConfig.appointmentsEndpoint}/schedule/check-availability?tutorId=$tutorId&date=$date&slot=$slot',
        token: token,
      );

      return response;
    } catch (e) {
      throw Exception(e.toString());
    }
  }
}
