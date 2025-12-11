import 'package:flutter/material.dart';
import '../models/tutor_model.dart';
import '../services/tutor_service.dart';

class TutorProvider with ChangeNotifier {
  List<TutorModel> _tutors = [];
  List<TutorModel> _filteredTutors = [];
  bool _isLoading = false;
  String? _error;

  List<TutorModel> get tutors => _filteredTutors.isEmpty ? _tutors : _filteredTutors;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Fetch all tutors
  Future<void> fetchTutors({
    String? categoryId,
    double? minRating,
    double? maxRate,
    String? search,
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _tutors = await TutorService.getAllTutors(
        categoryId: categoryId,
        minRating: minRating,
        maxRate: maxRate,
        search: search,
      );
      _filteredTutors = [];
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Fetch tutors by category
  Future<void> fetchTutorsByCategory(String categoryId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _tutors = await TutorService.getTutorsByCategory(categoryId);
      _filteredTutors = [];
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Search tutors locally
  void searchTutors(String query) {
    if (query.isEmpty) {
      _filteredTutors = [];
    } else {
      _filteredTutors = _tutors
          .where((tutor) =>
              tutor.user.name.toLowerCase().contains(query.toLowerCase()) ||
              tutor.category.name.toLowerCase().contains(query.toLowerCase()))
          .toList();
    }
    notifyListeners();
  }

  // Get tutor by ID
  TutorModel? getTutorById(String id) {
    try {
      return _tutors.firstWhere((tutor) => tutor.id == id);
    } catch (e) {
      return null;
    }
  }

  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}