import 'package:flutter/material.dart';
import 'package:my_app/screens/tutor/tutor_course_detail_screen.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../providers/course_provider.dart';
import '../../utils/constants.dart';
import 'create_course_screen.dart';
import 'edit_course_screen.dart';
import 'manage_lessons_screen.dart';

class ManageCoursesScreen extends StatefulWidget {
  const ManageCoursesScreen({super.key});

  @override
  State<ManageCoursesScreen> createState() => _ManageCoursesScreenState();
}

class _ManageCoursesScreenState extends State<ManageCoursesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CourseProvider>(context, listen: false).fetchMyCourses();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final courseProvider = Provider.of<CourseProvider>(context);

    final publishedCourses = courseProvider.myCourses
        .where((c) => c.status == 'published')
        .toList();
    final draftCourses = courseProvider.myCourses
        .where((c) => c.status == 'draft')
        .toList();
    final archivedCourses = courseProvider.myCourses
        .where((c) => c.status == 'archived')
        .toList();
    print("courseProvider ${courseProvider.myCourses}");
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Courses'),
        automaticallyImplyLeading: false,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: Colors.grey,
          tabs: [
            Tab(text: 'Published (${publishedCourses.length})'),
            Tab(text: 'Drafts (${draftCourses.length})'),
            Tab(text: 'Archived (${archivedCourses.length})'),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => courseProvider.fetchMyCourses(),
        child: courseProvider.isLoading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                controller: _tabController,
                children: [
                  _buildCoursesList(publishedCourses),
                  _buildCoursesList(draftCourses),
                  _buildCoursesList(archivedCourses),
                ],
              ),
      ),
    );
  }

  Widget _buildCoursesList(List courses) {
    if (courses.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.school_outlined, size: 80, color: Colors.grey[300]),
            const SizedBox(height: 16),
            Text(
              'No courses found',
              style: TextStyle(fontSize: 16, color: Colors.grey[600]),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const CreateCourseScreen()),
                );
              },
              icon: const Icon(Icons.add),
              label: const Text('Create Course'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: courses.length,
      itemBuilder: (context, index) {
        final course = courses[index];
        return _buildCourseCard(course);
      },
    );
  }

  Widget _buildCourseCard(course) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
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
          // Thumbnail
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Stack(
              children: [
                CachedNetworkImage(
                  imageUrl: course.thumbnail,
                  width: double.infinity,
                  height: 150,
                  fit: BoxFit.cover,
                  placeholder: (context, url) =>
                      Container(color: Colors.grey[300]),
                  errorWidget: (context, url, error) => Container(
                    color: Colors.grey[300],
                    child: const Icon(Icons.image, size: 50),
                  ),
                ),
                // Status Badge
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _getStatusColor(course.status),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      course.status.toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Content
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title
                Text(
                  course.title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8),

                // Category & Level
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        course.category.name,
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      course.level.toUpperCase(),
                      style: const TextStyle(fontSize: 10),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Stats
                Row(
                  children: [
                    _buildStatItem(
                      Icons.people,
                      '${course.enrolledCount}',
                      'Students',
                    ),
                    const SizedBox(width: 16),
                    _buildStatItem(
                      Icons.star,
                      course.rating.toStringAsFixed(1),
                      'Rating',
                    ),
                    const SizedBox(width: 16),
                    _buildStatItem(
                      Icons.access_time,
                      '${course.duration.toStringAsFixed(0)}h',
                      'Duration',
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Actions Row
                Row(
                  children: [
                    // 1. Lessons Button
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) =>
                                  ManageLessonsScreen(course: course),
                            ),
                          );
                        },
                        icon: const Icon(Icons.video_library, size: 18),
                        label: const Text('Lessons'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                          ), // Space bachane ke liye
                        ),
                      ),
                    ),

                    const SizedBox(width: 8),

                    // 2. Edit Button
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => EditCourseScreen(course: course),
                            ),
                          );
                        },
                        icon: const Icon(Icons.edit, size: 18),
                        label: const Text('Edit'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.orange,
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                        ),
                      ),
                    ),

                    const SizedBox(width: 4),
                    // ================= NEW VIEW ICON ADDED HERE =================
                    IconButton(
                      icon: const Icon(Icons.visibility), // Eye Icon
                      color: Colors.blueGrey, // Ya apni theme ka primary color
                      tooltip: 'View Course as Student',
                      onPressed: () {
                        // Navigate to TutorCourseDetailScreen
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) =>
                                TutorCourseDetailScreen(course: course),
                          ),
                        );
                      },
                    ),
                    // ============================================================

                    // 3. More Options
                    IconButton(
                      icon: const Icon(Icons.more_vert),
                      onPressed: () => _showOptionsMenu(context, course),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(IconData icon, String value, String label) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.grey[600]),
        const SizedBox(width: 4),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
            Text(label, style: TextStyle(fontSize: 9, color: Colors.grey[600])),
          ],
        ),
      ],
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'published':
        return Colors.green;
      case 'draft':
        return Colors.orange;
      case 'archived':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }

  void _showOptionsMenu(BuildContext context, course) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: Icon(
                  course.status == 'published' ? Icons.archive : Icons.publish,
                  color: AppColors.primary,
                ),
                title: Text(
                  course.status == 'published'
                      ? 'Archive Course'
                      : 'Publish Course',
                ),
                onTap: () {
                  Navigator.pop(context);
                  _updateCourseStatus(
                    course.id,
                    course.status == 'published' ? 'archived' : 'published',
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.people, color: Colors.blue),
                title: const Text('View Students'),
                onTap: () {
                  Navigator.pop(context);
                  _viewStudents(course.id);
                },
              ),
              ListTile(
                leading: const Icon(Icons.analytics, color: Colors.green),
                title: const Text('View Analytics'),
                onTap: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Analytics coming soon!')),
                  );
                },
              ),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.delete, color: Colors.red),
                title: const Text('Delete Course'),
                onTap: () {
                  Navigator.pop(context);
                  _confirmDelete(context, course.id);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _updateCourseStatus(String courseId, String newStatus) async {
    final courseProvider = Provider.of<CourseProvider>(context, listen: false);

    final success = await courseProvider.updateCourse(
      id: courseId,
      updates: {'status': newStatus},
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Course ${newStatus == 'published' ? 'published' : 'archived'} successfully',
          ),
          backgroundColor: Colors.green,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(courseProvider.error ?? 'Failed to update course'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _viewStudents(String courseId) {
    // TODO: Navigate to students list screen
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Students list coming soon!')));
  }

  void _confirmDelete(BuildContext context, String courseId) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Course'),
        content: const Text(
          'Are you sure you want to delete this course? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await _deleteCourse(courseId);
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteCourse(String courseId) async {
    final courseProvider = Provider.of<CourseProvider>(context, listen: false);

    final success = await courseProvider.deleteCourse(courseId);

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Course deleted successfully'),
          backgroundColor: Colors.green,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(courseProvider.error ?? 'Failed to delete course'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
}
