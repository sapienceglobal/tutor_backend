import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../providers/course_provider.dart';
import '../../services/enrollment_service.dart';
import '../../utils/constants.dart';

class TutorStudentsScreen extends StatefulWidget {
  const TutorStudentsScreen({super.key});

  @override
  State<TutorStudentsScreen> createState() => _TutorStudentsScreenState();
}

class _TutorStudentsScreenState extends State<TutorStudentsScreen> {
  String? _selectedCourseId;
  List<StudentEnrollment> _students = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadCourses();
  }

  Future<void> _loadCourses() async {
    final courseProvider = Provider.of<CourseProvider>(context, listen: false);
    await courseProvider.fetchMyCourses();
  }

  Future<void> _loadStudents(String courseId) async {
    setState(() {
      _isLoading = true;
    });

    try {
      final result = await EnrollmentService.getCourseStudents(courseId);

      // Parse the response
      List<StudentEnrollment> students = [];
      for (var item in result) {
        students.add(StudentEnrollment.fromJson(item));
      }

      setState(() {
        _students = students;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading students: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final courseProvider = Provider.of<CourseProvider>(context);
    final myCourses = courseProvider.myCourses;

    return Scaffold(
      appBar: AppBar(title: const Text('My Students')),
      body: Column(
        children: [
          // Course Filter
          if (myCourses.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              child: DropdownButtonFormField<String>(
                value: _selectedCourseId,
                decoration: InputDecoration(
                  labelText: 'Filter by Course',
                  prefixIcon: const Icon(Icons.school),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.grey[50],
                ),
                hint: const Text('Select a course'),
                items: [
                  const DropdownMenuItem(
                    value: null,
                    child: Text('All Courses'),
                  ),
                  ...myCourses.map((course) {
                    return DropdownMenuItem(
                      value: course.id,
                      child: Text(
                        course.title,
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  }).toList(),
                ],
                onChanged: (value) {
                  setState(() {
                    _selectedCourseId = value;
                    _students = [];
                  });
                  if (value != null) {
                    _loadStudents(value);
                  }
                },
              ),
            ),

          // Stats Summary
          if (_selectedCourseId != null && _students.isNotEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStatItem(
                    icon: Icons.people,
                    label: 'Students',
                    value: _students.length.toString(),
                  ),
                  _buildStatItem(
                    icon: Icons.trending_up,
                    label: 'Active',
                    value: _students
                        .where((s) => s.status == 'active')
                        .length
                        .toString(),
                  ),
                  _buildStatItem(
                    icon: Icons.check_circle,
                    label: 'Completed',
                    value: _students
                        .where((s) => s.status == 'completed')
                        .length
                        .toString(),
                  ),
                ],
              ),
            ),

          const SizedBox(height: 16),

          // Students List
          Expanded(child: _buildStudentsList()),
        ],
      ),
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Column(
      children: [
        Icon(icon, color: AppColors.primary, size: 28),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
        ),
        Text(label, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
      ],
    );
  }

  Widget _buildStudentsList() {
    // Show message if no course selected
    if (_selectedCourseId == null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.school_outlined, size: 80, color: Colors.grey[300]),
            const SizedBox(height: 16),
            Text(
              'Select a course to view students',
              style: TextStyle(fontSize: 16, color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }

    // Show loading
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    // Show empty state if no students
    if (_students.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.people_outline, size: 80, color: Colors.grey[300]),
            const SizedBox(height: 16),
            Text(
              'No students enrolled yet',
              style: TextStyle(fontSize: 16, color: Colors.grey[600]),
            ),
            const SizedBox(height: 8),
            Text(
              'Students will appear here once they enroll',
              style: TextStyle(fontSize: 14, color: Colors.grey[500]),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    // Show real students list from API
    return RefreshIndicator(
      onRefresh: () => _loadStudents(_selectedCourseId!),
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _students.length,
        itemBuilder: (context, index) {
          final student = _students[index];
          return _buildStudentCard(student);
        },
      ),
    );
  }

  Widget _buildStudentCard(StudentEnrollment student) {
    Color statusColor = student.status == 'completed'
        ? Colors.green
        : Colors.blue;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // Avatar with Profile Image
              ClipOval(
                child: CachedNetworkImage(
                  imageUrl: student.profileImage,
                  width: 50,
                  height: 50,
                  fit: BoxFit.cover,
                  placeholder: (context, url) => Container(
                    color: AppColors.primary.withOpacity(0.1),
                    child: Center(
                      child: Text(
                        student.name[0].toUpperCase(),
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                        ),
                      ),
                    ),
                  ),
                  errorWidget: (context, url, error) => Container(
                    color: AppColors.primary.withOpacity(0.1),
                    child: Center(
                      child: Text(
                        student.name[0].toUpperCase(),
                        style: TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),

              // Student Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student.name,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      student.email,
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (student.phone.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        student.phone,
                        style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                      ),
                    ],
                  ],
                ),
              ),

              // Status Badge
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  student.status == 'completed' ? 'Completed' : 'Active',
                  style: TextStyle(
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Progress Bar
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Course Progress',
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                  Text(
                    '${student.progressPercentage.toStringAsFixed(0)}%',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: student.progressPercentage / 100,
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                  minHeight: 6,
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // Footer Info
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Enrolled Date
              Row(
                children: [
                  Icon(Icons.calendar_today, size: 14, color: Colors.grey[600]),
                  const SizedBox(width: 6),
                  Text(
                    'Enrolled: ${DateFormat('dd/MM/yyyy').format(student.enrolledAt)}',
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),

              // Last Accessed
              Row(
                children: [
                  Icon(Icons.access_time, size: 14, color: Colors.grey[600]),
                  const SizedBox(width: 6),
                  Text(
                    _getTimeAgo(student.lastAccessed),
                    style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _getTimeAgo(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays > 30) {
      return '${(difference.inDays / 30).floor()}mo ago';
    } else if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }
}

// ✅ Student Enrollment Model
class StudentEnrollment {
  final String enrollmentId;
  final String name;
  final String email;
  final String phone;
  final String profileImage;
  final DateTime enrolledAt;
  final DateTime lastAccessed;
  final String status;
  final double progressPercentage;
  final int completedLessons;
  final DateTime? completedAt;

  StudentEnrollment({
    required this.enrollmentId,
    required this.name,
    required this.email,
    required this.phone,
    required this.profileImage,
    required this.enrolledAt,
    required this.lastAccessed,
    required this.status,
    required this.progressPercentage,
    required this.completedLessons,
    this.completedAt,
  });

  factory StudentEnrollment.fromJson(Map<String, dynamic> json) {
    final studentData = json['studentId'] ?? {};
    final progressData = json['progress'] ?? {};

    return StudentEnrollment(
      enrollmentId: json['_id'] ?? '',
      name: studentData['name'] ?? 'Unknown',
      email: studentData['email'] ?? '',
      phone: studentData['phone'] ?? '',
      profileImage:
          studentData['profileImage'] ?? 'https://via.placeholder.com/150',
      enrolledAt: json['enrolledAt'] != null
          ? DateTime.parse(json['enrolledAt'])
          : DateTime.now(),
      lastAccessed: json['lastAccessed'] != null
          ? DateTime.parse(json['lastAccessed'])
          : DateTime.now(),
      status: json['status'] ?? 'active',
      progressPercentage: (progressData['percentage'] ?? 0).toDouble(),
      completedLessons:
          (progressData['completedLessons'] as List?)?.length ?? 0,
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'])
          : null,
    );
  }
}
