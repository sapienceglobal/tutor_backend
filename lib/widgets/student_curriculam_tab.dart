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

class _StudentCurriculumTabState extends State<StudentCurriculumTab>
    with SingleTickerProviderStateMixin {
  Map<String, List<LessonModel>> _lessonsByModule = {};
  List<ExamModel> _exams = [];
  bool _isLoading = false;
  String _selectedTab = 'curriculum';
  late AnimationController _animationController;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _loadContent();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _loadContent() async {
    setState(() => _isLoading = true);

    try {
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

      if (widget.isEnrolled) {
        final examResult = await ExamService.getExamsByCourse(widget.course.id);
        if (examResult['success']) {
          final allExams = examResult['exams'] as List<ExamModel>;
          setState(() {
            _exams = allExams.where((exam) => exam.isPublished).toList();
          });
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white),
                const SizedBox(width: 12),
                Expanded(child: Text('Error: $e')),
              ],
            ),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF8F9FE),
      child: Column(
        children: [
          // Modern Tab Selector
          Container(
            margin: const EdgeInsets.all(20),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: _buildModernTabButton(
                    'Curriculum',
                    'curriculum',
                    Icons.play_circle_filled,
                    _getTotalLessons(),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _buildModernTabButton(
                    'Exams',
                    'exams',
                    Icons.assignment_rounded,
                    _exams.length,
                  ),
                ),
              ],
            ),
          ),

          // Content
          Expanded(
            child: _isLoading
                ? _buildShimmerLoading()
                : RefreshIndicator(
                    onRefresh: _loadContent,
                    color: AppColors.primary,
                    child: _selectedTab == 'curriculum'
                        ? _buildCurriculumContent()
                        : _buildExamsContent(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildModernTabButton(
    String label,
    String value,
    IconData icon,
    int count,
  ) {
    final isSelected = _selectedTab == value;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            setState(() => _selectedTab = value);
            _animationController.forward(from: 0);
          },
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
            decoration: BoxDecoration(
              gradient: isSelected
                  ? LinearGradient(
                      colors: [
                        AppColors.primary,
                        AppColors.primary.withOpacity(0.8),
                      ],
                    )
                  : null,
              color: isSelected ? null : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  color: isSelected ? Colors.white : Colors.grey.shade600,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        color: isSelected ? Colors.white : Colors.grey.shade700,
                        fontWeight: isSelected
                            ? FontWeight.bold
                            : FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    if (count > 0)
                      Text(
                        '$count ${label == 'Curriculum' ? 'lessons' : 'exams'}',
                        style: TextStyle(
                          color: isSelected
                              ? Colors.white.withOpacity(0.9)
                              : Colors.grey.shade500,
                          fontSize: 10,
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
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
        color: Colors.blue,
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      physics: const BouncingScrollPhysics(),
      itemCount: widget.course.modules.length,
      itemBuilder: (context, index) {
        final module = widget.course.modules[index];
        final lessons = _lessonsByModule[module.id] ?? [];
        return TweenAnimationBuilder(
          tween: Tween<double>(begin: 0.0, end: 1.0),
          duration: Duration(milliseconds: 400 + (index * 100)),
          curve: Curves.easeOutCubic,
          builder: (context, value, child) {
            return Transform.translate(
              offset: Offset(0, 20 * (1 - value)),
              child: Opacity(opacity: value, child: child),
            );
          },
          child: _buildModuleCard(module, lessons, index),
        );
      },
    );
  }

  Widget _buildExamsContent() {
    if (!widget.isEnrolled) {
      return _buildEmptyState(
        icon: Icons.lock_outline,
        title: 'Enroll to access exams',
        subtitle: 'You need to enroll in this course to take exams',
        color: Colors.orange,
      );
    }

    if (_exams.isEmpty) {
      return _buildEmptyState(
        icon: Icons.assignment_outlined,
        title: 'No exams available',
        subtitle: 'The instructor hasn\'t published any exams yet',
        color: Colors.grey,
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      physics: const BouncingScrollPhysics(),
      itemCount: _exams.length,
      itemBuilder: (context, index) {
        return TweenAnimationBuilder(
          tween: Tween<double>(begin: 0.0, end: 1.0),
          duration: Duration(milliseconds: 400 + (index * 100)),
          curve: Curves.easeOutCubic,
          builder: (context, value, child) {
            return Transform.translate(
              offset: Offset(0, 20 * (1 - value)),
              child: Opacity(opacity: value, child: child),
            );
          },
          child: _buildExamCard(_exams[index]),
        );
      },
    );
  }

  Widget _buildModuleCard(
    CourseModule module,
    List<LessonModel> lessons,
    int index,
  ) {
    final totalLessons = lessons.length;
    final enrollmentProvider = Provider.of<EnrollmentProvider>(context);
    final completedLessons = lessons.where((lesson) {
      return enrollmentProvider.isLessonCompleted(widget.course.id, lesson.id);
    }).length;

    final progress = totalLessons > 0 ? completedLessons / totalLessons : 0.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.all(20),
          childrenPadding: const EdgeInsets.only(bottom: 12),
          leading: Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primary, AppColors.primary.withOpacity(0.7)],
              ),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: Text(
                '${index + 1}',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
          ),
          title: Text(
            module.title,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 17,
              color: Color(0xFF1A1A1A),
            ),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (module.description.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  module.description,
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.blue.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.play_circle_outline,
                          size: 14,
                          color: Colors.blue.shade700,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '$totalLessons lessons',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.blue.shade700,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (widget.isEnrolled && totalLessons > 0) ...[
                    const SizedBox(width: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.check_circle,
                            size: 14,
                            color: Colors.green.shade700,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '$completedLessons/$totalLessons done',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.green.shade700,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
              if (widget.isEnrolled && totalLessons > 0) ...[
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: LinearProgressIndicator(
                    value: progress,
                    backgroundColor: Colors.grey.shade200,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.green),
                    minHeight: 6,
                  ),
                ),
              ],
            ],
          ),
          children: [
            if (lessons.isEmpty)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.info_outline, color: Colors.grey.shade400),
                    const SizedBox(width: 8),
                    Text(
                      'No lessons in this module yet',
                      style: TextStyle(color: Colors.grey.shade600),
                    ),
                  ],
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
    final enrollmentProvider = Provider.of<EnrollmentProvider>(context);
    final bool isCompleted = enrollmentProvider.isLessonCompleted(
      widget.course.id,
      lesson.id,
    );
    final isLocked = !widget.isEnrolled && !lesson.isFree;

    IconData lessonIcon;
    Color iconColor;

    switch (lesson.type) {
      case 'video':
        lessonIcon = Icons.play_circle_filled;
        iconColor = Colors.blue;
        break;
      case 'document':
        lessonIcon = Icons.description;
        iconColor = Colors.orange;
        break;
      case 'quiz':
        lessonIcon = Icons.quiz;
        iconColor = Colors.purple;
        break;
      default:
        lessonIcon = Icons.menu_book;
        iconColor = Colors.grey;
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
      decoration: BoxDecoration(
        color: isLocked
            ? Colors.grey.shade50
            : (isCompleted ? Colors.green.withOpacity(0.05) : Colors.white),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isLocked
              ? Colors.grey.shade200
              : (isCompleted
                    ? Colors.green.withOpacity(0.3)
                    : Colors.grey.shade200),
          width: 1.5,
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: isLocked ? Colors.grey.shade200 : iconColor.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            isLocked ? Icons.lock_rounded : lessonIcon,
            color: isLocked ? Colors.grey.shade400 : iconColor,
            size: 22,
          ),
        ),
        title: Text(
          lesson.title,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: isLocked ? Colors.grey.shade500 : const Color(0xFF1A1A1A),
          ),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(
            children: [
              if (lesson.isFree)
                Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.green,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'FREE',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              if (lesson.type == 'video' && lesson.content.duration != null)
                Row(
                  children: [
                    Icon(
                      Icons.access_time,
                      size: 12,
                      color: Colors.grey.shade600,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${(lesson.content.duration! / 60).toStringAsFixed(0)} min',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey.shade600,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
        trailing: isLocked
            ? null
            : Transform.scale(
                scale: 1.2,
                child: Checkbox(
                  value: isCompleted,
                  activeColor: Colors.green,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(6),
                  ),
                  onChanged: (bool? value) async {
                    if (value == true) {
                      await enrollmentProvider.markLessonAsCompleted(
                        widget.course.id,
                        lesson.id,
                      );
                      setState(() {});
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(
                                    Icons.check_circle,
                                    color: Colors.white,
                                    size: 20,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                const Text(
                                  'Lesson marked as completed!',
                                  style: TextStyle(fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                            duration: const Duration(seconds: 2),
                            backgroundColor: Colors.green,
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        );
                      }
                    }
                  },
                ),
              ),
        onTap: isLocked
            ? () {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Row(
                      children: [
                        const Icon(Icons.lock, color: Colors.white),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Enroll to access this lesson',
                            style: TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                    backgroundColor: Colors.orange,
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                );
              }
            : () => _openLesson(lesson),
      ),
    );
  }

  Widget _buildExamCard(ExamModel exam) {
    final now = DateTime.now();
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

    final isLocked = isDateRestricted || !exam.canTakeExam;

    Color statusColor = Colors.grey;
    String statusText = 'Not Started';
    IconData statusIcon = Icons.radio_button_unchecked;

    if (exam.attemptCount > 0) {
      final lastScore = exam.lastAttempt?['score'] ?? 0;
      final isPassed = exam.lastAttempt?['isPassed'] ?? false;
      if (isPassed) {
        statusColor = Colors.green;
        statusText = 'Passed';
        statusIcon = Icons.check_circle;
      } else {
        statusColor = Colors.red;
        statusText = 'Failed';
        statusIcon = Icons.cancel;
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isLocked
              ? Colors.grey.shade200
              : _getExamColor(exam.type).withOpacity(0.2),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: isLocked
              ? () => _showLockedReason(exam, isDateRestricted, dateStatus)
              : () => _openExam(exam),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            _getExamColor(exam.type),
                            _getExamColor(exam.type).withOpacity(0.7),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: [
                          BoxShadow(
                            color: _getExamColor(exam.type).withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Icon(
                        _getExamIcon(exam.type),
                        color: Colors.white,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            exam.title,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1A1A1A),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: _getExamColor(
                                    exam.type,
                                  ).withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  exam.type.toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: _getExamColor(exam.type),
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                              if (dateStatus.isNotEmpty) ...[
                                const SizedBox(width: 8),
                                Icon(
                                  Icons.schedule,
                                  size: 12,
                                  color: Colors.grey.shade600,
                                ),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    dateStatus,
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey.shade600,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: statusColor.withOpacity(0.3),
                          width: 1.5,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(statusIcon, color: statusColor, size: 16),
                          const SizedBox(width: 6),
                          Text(
                            statusText,
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    _buildExamStat(
                      Icons.timer_outlined,
                      '${exam.duration} min',
                      Colors.blue,
                    ),
                    const SizedBox(width: 16),
                    _buildExamStat(
                      Icons.help_outline,
                      '${exam.totalQuestions} Qs',
                      Colors.orange,
                    ),
                    const SizedBox(width: 16),
                    _buildExamStat(
                      exam.attemptCount >= exam.maxAttempts
                          ? Icons.lock
                          : Icons.replay,
                      exam.maxAttempts > 0
                          ? '${exam.attemptCount}/${exam.maxAttempts}'
                          : 'Unlimited',
                      Colors.purple,
                    ),
                  ],
                ),
                if (!isLocked && exam.attemptCount > 0) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.refresh, color: AppColors.primary, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'Tap to Retake',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildExamStat(IconData icon, String text, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                text,
                style: TextStyle(
                  fontSize: 12,
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildShimmerLoading() {
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: 3,
      itemBuilder: (context, index) {
        return Container(
          height: 120,
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: Colors.grey.shade200,
            borderRadius: BorderRadius.circular(20),
          ),
        );
      },
    );
  }

  Widget _buildEmptyState({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 80, color: color.withOpacity(0.5)),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1A1A1A),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
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

  void _openLesson(LessonModel lesson) {
    List<LessonModel> allLessons = [];
    _lessonsByModule.forEach((key, value) {
      allLessons.addAll(value);
    });

    final int index = allLessons.indexWhere((l) => l.id == lesson.id);
    if (index == -1) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => LessonPlayerScreen(
          lessons: allLessons,
          initialIndex: index,
          courseId: widget.course.id,
        ),
      ),
    ).then((_) {
      _loadContent();
    });
  }

  void _openExam(ExamModel exam) {
    if (!widget.isEnrolled) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.lock, color: Colors.white),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Please enroll in the course to take this exam',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          backgroundColor: Colors.orange,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );
      return;
    }

    if (exam.isScheduled && exam.startDate != null && exam.endDate != null) {
      final now = DateTime.now();
      if (now.isBefore(exam.startDate!)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Exam opens on ${exam.startDate!.toString().split(' ')[0]}',
            ),
            backgroundColor: Colors.orange,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
        return;
      }
      if (now.isAfter(exam.endDate!)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('This exam has ended'),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
        return;
      }
    }

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) =>
            StudentExamScreen(exam: exam, courseId: widget.course.id),
      ),
    ).then((_) {
      _loadContent();
    });
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
        content: Row(
          children: [
            const Icon(Icons.info_outline, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(child: Text(reason)),
          ],
        ),
        backgroundColor: Colors.orange,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }
}
