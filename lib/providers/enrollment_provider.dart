import 'package:flutter/material.dart';
import '../models/enrollment_model.dart';
import '../services/enrollment_service.dart';
import '../services/progress_service.dart';

class EnrollmentProvider with ChangeNotifier {
  List<EnrollmentModel> _enrollments = [];
  bool _isLoading = false;
  String? _error;

  // Getters
  List<EnrollmentModel> get enrollments => _enrollments;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Get active enrollments
  List<EnrollmentModel> get activeEnrollments {
    return _enrollments.where((e) => e.status == 'active').toList();
  }

  // Get completed enrollments
  List<EnrollmentModel> get completedEnrollments {
    return _enrollments.where((e) => e.status == 'completed').toList();
  }

  // ✅ Check if lesson is completed
  bool isLessonCompleted(String courseId, String lessonId) {
    final enrollment = getEnrollmentByCourseId(courseId);
    return enrollment?.progress.completedLessons.contains(lessonId) ?? false;
  }

  // ✅ Fetch my enrollments
  Future<void> fetchMyEnrollments({String? status}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _enrollments = await EnrollmentService.getMyEnrollments(status: status);
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ✅ Mark lesson as completed
  Future<void> markLessonAsCompleted(String courseId, String lessonId) async {
    try {
      // Backend API call
      await ProgressService.updateProgress(
        courseId: courseId,
        lessonId: lessonId,
        completed: true,
      );

      // Backend automatically updates enrollment percentage
      // So refresh enrollments to get updated data
      await fetchMyEnrollments();
    } catch (e) {
      print('Error marking lesson completed: $e');
    }
  }

  // ✅ Enroll in course
  Future<bool> enrollInCourse(String courseId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await EnrollmentService.enrollInCourse(courseId);

      if (response['success']) {
        await fetchMyEnrollments();
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

  // ✅ Unenroll from course
  Future<bool> unenrollFromCourse(String enrollmentId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await EnrollmentService.unenrollFromCourse(enrollmentId);

      if (response['success']) {
        await fetchMyEnrollments();
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

  // ✅ Check if enrolled in a course
  bool isEnrolledInCourse(String courseId) {
    return _enrollments.any((enrollment) => enrollment.course.id == courseId);
  }

  // ✅ Get enrollment by course ID
  EnrollmentModel? getEnrollmentByCourseId(String courseId) {
    try {
      return _enrollments.firstWhere(
        (enrollment) => enrollment.course.id == courseId,
      );
    } catch (e) {
      return null;
    }
  }

  // ✅ Refresh course progress
  Future<void> refreshCourseProgress(String courseId) async {
    // Backend automatically recalculates percentage on /api/progress call.
    // We just need to re-fetch the enrollments to get the updated percentage.
    await fetchMyEnrollments();
  }

  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}