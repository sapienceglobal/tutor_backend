import 'package:flutter/material.dart';
import 'package:my_app/screens/courses/lesson_player_screen.dart';
import 'package:my_app/widgets/student_exam_screen.dart';
import 'package:provider/provider.dart';
import '../../models/course_model.dart';
import '../../models/lesson_model.dart';
import '../../models/exam_model.dart';
import '../../services/lesson_service.dart';
import '../../services/exam_service.dart';
import '../../utils/constants.dart';
import '../../providers/enrollment_provider.dart';

class StudentCurriculumTab extends StatefulWidget {
  final CourseModel course;
  final bool isEnrolled;

  const StudentCurriculumTab({
    super.key,
    required this.course,
    required this.isEnrolled,
  });

  @override
  State<StudentCurriculumTab> createState() => _StudentCurriculumTabState();
}

class _StudentCurriculumTabState extends State<StudentCurriculumTab> {
  Map<String, List<LessonModel>> _lessonsByModule = {};
  List<ExamModel> _exams = [];
  bool _isLoading = false;
  String _selectedTab = 'curriculum'; // curriculum or exams

  @override
  void initState() {
    super.initState();
    _loadContent();
  }

  Future<void> _loadContent() async {
    setState(() => _isLoading = true);

    try {
      // Load Lessons
      final lessonResult = await LessonService.getLessonsByCourse(
        widget.course.id,
      );
      if (lessonResult['success']) {
        final lessons = lessonResult['lessons'] as List<LessonModel>;
        Map<String, List<LessonModel>> grouped = {};

        for (var lesson in lessons) {
          if (!grouped.containsKey(lesson.moduleId)) {
            grouped[lesson.moduleId] = [];
          }
          grouped[lesson.moduleId]!.add(lesson);
        }

        grouped.forEach((key, value) {
          value.sort((a, b) => a.order.compareTo(b.order));
        });

        setState(() => _lessonsByModule = grouped);
      }

      // Load Exams (only published ones for students)
      if (widget.isEnrolled) {
        final examResult = await ExamService.getExamsByCourse(widget.course.id);
        if (examResult['success']) {
          final allExams = examResult['exams'] as List<ExamModel>;
          setState(() {
            _exams = allExams.where((exam) => exam.isPublished).toList();
            // _exams = allExams;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Tab Selector
        Container(
          padding: const EdgeInsets.all(16),
          color: Colors.grey[100],
          child: Row(
            children: [
              Expanded(
                child: _buildTabButton(
                  'Curriculum',
                  'curriculum',
                  Icons.video_library,
                  _getTotalLessons(),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildTabButton(
                  'Exams',
                  'exams',
                  Icons.assignment,
                  _exams.length,
                ),
              ),
            ],
          ),
        ),

        // Content
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _loadContent,
                  child: _selectedTab == 'curriculum'
                      ? _buildCurriculumContent()
                      : _buildExamsContent(),
                ),
        ),
      ],
    );
  }

  Widget _buildTabButton(String label, String value, IconData icon, int count) {
    final isSelected = _selectedTab == value;
    return InkWell(
      onTap: () => setState(() => _selectedTab = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? AppColors.primary : Colors.grey[300]!,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              color: isSelected ? Colors.white : Colors.grey[600],
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.grey[700],
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                fontSize: 12,
              ),
            ),
            if (count > 0)
              Text(
                '$count',
                style: TextStyle(
                  color: isSelected ? Colors.white : Colors.grey[600],
                  fontSize: 10,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurriculumContent() {
    if (widget.course.modules.isEmpty) {
      return _buildEmptyState(
        icon: Icons.video_library_outlined,
        title: 'No curriculum yet',
        subtitle: 'This course is still being developed',
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: widget.course.modules.length,
      itemBuilder: (context, index) {
        final module = widget.course.modules[index];
        final lessons = _lessonsByModule[module.id] ?? [];
        return _buildModuleCard(module, lessons, index);
      },
    );
  }

  Widget _buildExamsContent() {
    if (!widget.isEnrolled) {
      return _buildEmptyState(
        icon: Icons.lock_outline,
        title: 'Enroll to access exams',
        subtitle: 'You need to enroll in this course to take exams',
      );
    }

    if (_exams.isEmpty) {
      return _buildEmptyState(
        icon: Icons.assignment_outlined,
        title: 'No exams available',
        subtitle: 'The instructor hasn\'t published any exams yet',
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _exams.length,
      itemBuilder: (context, index) {
        return _buildExamCard(_exams[index]);
      },
    );
  }

  Widget _buildModuleCard(
    CourseModule module,
    List<LessonModel> lessons,
    int index,
  ) {
    final totalLessons = lessons.length;
    final completedLessons = 0; // TODO: Get from progress

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.all(16),
          childrenPadding: const EdgeInsets.only(bottom: 8),
          leading: CircleAvatar(
            backgroundColor: AppColors.primary.withOpacity(0.1),
            child: Text(
              '${index + 1}',
              style: TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          title: Text(
            module.title,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (module.description.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  module.description,
                  style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.play_circle_outline,
                    size: 14,
                    color: Colors.grey[600],
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '$totalLessons lessons',
                    style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                  ),
                  if (widget.isEnrolled) ...[
                    const SizedBox(width: 12),
                    Text(
                      '$completedLessons/$totalLessons completed',
                      style: TextStyle(fontSize: 12, color: Colors.green[700]),
                    ),
                  ],
                ],
              ),
            ],
          ),
          children: [
            if (lessons.isEmpty)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  'No lessons in this module yet',
                  style: TextStyle(color: Colors.grey[600]),
                ),
              )
            else
              ...lessons.map((lesson) => _buildLessonTile(lesson)),
          ],
        ),
      ),
    );
  }

  Widget _buildLessonTile(LessonModel lesson) {
    // 1. Provider se Enrollment data access karein
    final enrollmentProvider = Provider.of<EnrollmentProvider>(context);

    // 2. Check karein ki ye lesson completed hai ya nahi
    // (Note: Aapke provider me 'isLessonCompleted' ya 'completedLessonIds' hona chahiye)
    // Filhal ke liye agar provider me list hai to aise check karein:
    final bool isCompleted = enrollmentProvider.isLessonCompleted(widget.course.id,lesson.id);

    final isLocked = !widget.isEnrolled && !lesson.isFree;

    IconData lessonIcon;
    Color iconColor;

    switch (lesson.type) {
      case 'video':
        lessonIcon = Icons.play_circle_outline;
        iconColor = Colors.blue;
        break;
      case 'document':
        lessonIcon = Icons.description_outlined;
        iconColor = Colors.orange;
        break;
      case 'quiz':
        lessonIcon = Icons.quiz_outlined;
        iconColor = Colors.purple;
        break;
      default:
        lessonIcon = Icons.menu_book;
        iconColor = Colors.grey;
    }

    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: iconColor.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          isLocked ? Icons.lock : lessonIcon,
          color: isLocked ? Colors.grey : iconColor,
          size: 20,
        ),
      ),
      title: Text(
        lesson.title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: isLocked ? Colors.grey : Colors.black,
        ),
      ),
      subtitle: Row(
        children: [
          if (lesson.isFree)
            Container(
              margin: const EdgeInsets.only(top: 4, right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.green.withOpacity(0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                'FREE',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Colors.green,
                ),
              ),
            ),
          // Duration logic...
          if (lesson.type == 'video' && lesson.content.duration != null)
            Text(
              '${(lesson.content.duration! / 60).toStringAsFixed(0)} min',
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
        ],
      ),

      // --- MAIN CHANGE YAHAN HAI (Checkbox Logic) ---
      trailing: isLocked
          ? null // Agar lock hai to kuch mat dikhao ya Lock icon dikhao
          : Checkbox(
              value: isCompleted,
              activeColor: Colors.green,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(4),
              ),
              onChanged: (bool? value) async {
                if (value == true) {
                  // 1. API Call (Progress Route hit hoga)
                  await enrollmentProvider.markLessonAsCompleted(
                    widget.course.id,
                    lesson.id,
                  );

                  // 2. UI Refresh karein
                  setState(() {
                    // Ye UI ko rebuild karega taaki tick turant dikhe
                  });

                  // 3. User Feedback
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text("Lesson marked as completed!"),
                        duration: Duration(seconds: 1),
                        backgroundColor: Colors.green,
                      ),
                    );
                  }
                }
              },
            ),

      // ----------------------------------------------
      onTap: isLocked
          ? () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Enroll to access this lesson'),
                  backgroundColor: Colors.orange,
                ),
              );
            }
          : () => _openLesson(lesson),
    );
  }

  Widget _buildExamCard(ExamModel exam) {
    final now = DateTime.now();

    // Logic for availability
    bool isDateRestricted = false;
    String dateStatus = '';

    if (exam.isScheduled) {
      if (exam.startDate != null && now.isBefore(exam.startDate!)) {
        isDateRestricted = true;
        dateStatus = 'Opens: ${_formatDate(exam.startDate!)}';
      } else if (exam.endDate != null && now.isAfter(exam.endDate!)) {
        isDateRestricted = true;
        dateStatus = 'Expired: ${_formatDate(exam.endDate!)}';
      } else if (exam.endDate != null) {
        dateStatus = 'Due: ${_formatDate(exam.endDate!)}';
      }
    }

    // Logic for attempts
    final attemptsLeft = exam.maxAttempts - exam.attemptCount;
    final isLocked = isDateRestricted || !exam.canTakeExam;

    // Status Color Logic
    Color statusColor = Colors.grey;
    String statusText = 'Not Started';

    if (exam.attemptCount > 0) {
      final lastScore = exam.lastAttempt?['score'] ?? 0;
      final isPassed = exam.lastAttempt?['isPassed'] ?? false;
      if (isPassed) {
        statusColor = Colors.green;
        statusText = 'Passed ($lastScore)';
      } else {
        statusColor = Colors.red;
        statusText = 'Failed ($lastScore)';
      }
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: isLocked
            ? () => _showLockedReason(exam, isDateRestricted, dateStatus)
            : () => _openExam(exam),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Row: Icon + Title + Status Chip
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _getExamColor(exam.type).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      _getExamIcon(exam.type),
                      color: _getExamColor(exam.type),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          exam.title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Text(
                              exam.type.toUpperCase(),
                              style: TextStyle(
                                fontSize: 11,
                                color: _getExamColor(exam.type),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(width: 8),
                            if (dateStatus.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.grey[200],
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  dateStatus,
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.grey[800],
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  // Status Chip
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: statusColor.withOpacity(0.5)),
                    ),
                    child: Text(
                      statusText,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Stats Row (Duration, Questions, Attempts)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildMiniInfo(Icons.timer, '${exam.duration} min'),
                  _buildMiniInfo(
                    Icons.help_outline,
                    '${exam.totalQuestions} Qs',
                  ),

                  // Attempts Visual
                  if (exam.maxAttempts > 0)
                    Row(
                      children: [
                        Icon(
                          exam.attemptCount >= exam.maxAttempts
                              ? Icons.lock
                              : Icons.replay,
                          size: 14,
                          color: Colors.grey[600],
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${exam.attemptCount}/${exam.maxAttempts} Attempts',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    )
                  else
                    const Text(
                      'Unlimited Attempts',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                ],
              ),

              // Action Button (Full Width if needed, or visual indicator)
              if (!isLocked && exam.attemptCount > 0) ...[
                const SizedBox(height: 12),
                const Divider(height: 1),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Tap to Retake',
                      style: TextStyle(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    Icon(
                      Icons.arrow_forward,
                      size: 14,
                      color: AppColors.primary,
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMiniInfo(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 14, color: Colors.grey),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }

  void _showLockedReason(
    ExamModel exam,
    bool isDateRestricted,
    String dateStatus,
  ) {
    String reason = '';
    if (isDateRestricted) {
      reason = 'This exam is not available right now.\n$dateStatus';
    } else if (!exam.canTakeExam) {
      reason =
          'You have used all your attempts (${exam.maxAttempts}/${exam.maxAttempts}).';
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(reason),
        backgroundColor: Colors.orange,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }

  Widget _buildExamInfo(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: Colors.grey[600]),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(fontSize: 12, color: Colors.grey[700])),
      ],
    );
  }

  Widget _buildEmptyState({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 80, color: Colors.grey[300]),
            const SizedBox(height: 16),
            Text(
              title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: TextStyle(color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Color _getExamColor(String type) {
    switch (type) {
      case 'midterm':
        return Colors.orange;
      case 'final':
        return Colors.red;
      case 'quiz':
        return Colors.purple;
      case 'practice':
        return Colors.blue;
      default:
        return Colors.green;
    }
  }

  IconData _getExamIcon(String type) {
    switch (type) {
      case 'midterm':
        return Icons.description;
      case 'final':
        return Icons.assignment_turned_in;
      case 'quiz':
        return Icons.quiz;
      case 'practice':
        return Icons.school;
      default:
        return Icons.assignment;
    }
  }

  int _getTotalLessons() {
    return _lessonsByModule.values.fold(
      0,
      (sum, lessons) => sum + lessons.length,
    );
  }

  // StudentCurriculumTab class ke andar

  void _openLesson(LessonModel lesson) {
    // 1. Get all lessons from your map to a single flattened list
    List<LessonModel> allLessons = [];
    _lessonsByModule.forEach((key, value) {
      allLessons.addAll(value);
    });

    // 2. Find the index of the clicked lesson
    final int index = allLessons.indexWhere((l) => l.id == lesson.id);

    if (index == -1) return; // Should not happen

    // 3. Navigate passing the LIST and INDEX
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => LessonPlayerScreen(
          lessons: allLessons, // PASS ALL LESSONS
          initialIndex: index, // PASS CURRENT INDEX
          courseId: widget.course.id,
        ),
      ),
    ).then((_) {
      // Reload content after returning (in case progress was updated)
      _loadContent();
    });
  }

  void _openExam(ExamModel exam) {
    // Check if exam is available
    if (!widget.isEnrolled) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enroll in the course to take this exam'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    // Check schedule
    if (exam.isScheduled && exam.startDate != null && exam.endDate != null) {
      final now = DateTime.now();
      if (now.isBefore(exam.startDate!)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Exam opens on ${exam.startDate!.toString().split(' ')[0]}',
            ),
            backgroundColor: Colors.orange,
          ),
        );
        return;
      }
      if (now.isAfter(exam.endDate!)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('This exam has ended'),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }
    }

    // Navigate to exam
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) =>
            StudentExamScreen(exam: exam, courseId: widget.course.id),
      ),
    ).then((_) {
      // Reload after exam completion
      _loadContent();
    });
  }
}
