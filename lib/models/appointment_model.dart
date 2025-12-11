import 'user_model.dart';
import 'tutor_model.dart';

class AppointmentModel {
  final String id;
  final UserModel student;
  final TutorModel tutor;
  final DateTime dateTime;
  final int duration;
  final String status;
  final double amount;
  final String notes;

  AppointmentModel({
    required this.id,
    required this.student,
    required this.tutor,
    required this.dateTime,
    required this.duration,
    required this.status,
    required this.amount,
    this.notes = '',
  });

  factory AppointmentModel.fromJson(Map<String, dynamic> json) {
    return AppointmentModel(
      id: json['_id'] ?? '',
      student: UserModel.fromJson(json['studentId'] ?? {}),
      tutor: TutorModel.fromJson(json['tutorId'] ?? {}),
      dateTime: DateTime.parse(json['dateTime'] ?? DateTime.now().toString()),
      duration: json['duration'] ?? 60,
      status: json['status'] ?? 'pending',
      amount: (json['amount'] ?? 0).toDouble(),
      notes: json['notes'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'studentId': student.toJson(),
      'tutorId': tutor.toJson(),
      'dateTime': dateTime.toIso8601String(),
      'duration': duration,
      'status': status,
      'amount': amount,
      'notes': notes,
    };
  }
}