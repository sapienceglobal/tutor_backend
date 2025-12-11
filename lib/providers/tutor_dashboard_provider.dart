import 'package:flutter/material.dart';
import '../models/tutor_dashboard_stats_model.dart';
import '../services/tutor_dashboard_service.dart';

class DashboardProvider with ChangeNotifier {
  DashboardStatsModel? _stats;
  bool _isLoading = false;
  String? _error;

  DashboardStatsModel? get stats => _stats;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Fetch dashboard statistics
  Future<void> fetchStats() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      print('📱 DashboardProvider: Fetching stats...');
      _stats = await DashboardService.getTutorStats();
      print('✅ DashboardProvider: Stats loaded');
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
      print('❌ DashboardProvider: Error - $_error');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Clear error
  void clearError() {
    _error = null;
    notifyListeners();
  }
}