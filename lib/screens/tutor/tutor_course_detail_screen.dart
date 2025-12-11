import 'package:flutter/material.dart';
import 'package:my_app/screens/tutor/manage_exam_screen.dart';
import '../../models/course_model.dart';
import '../../utils/constants.dart';
import 'manage_lessons_screen.dart';


class TutorCourseDetailScreen extends StatefulWidget {
  final CourseModel course;

  const TutorCourseDetailScreen({super.key, required this.course});

  @override
  State<TutorCourseDetailScreen> createState() => _TutorCourseDetailScreenState();
}

class _TutorCourseDetailScreenState extends State<TutorCourseDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.course.title),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: Colors.grey,
          tabs: const [
            Tab(icon: Icon(Icons.info_outline), text: 'Overview'),
            Tab(icon: Icon(Icons.video_library), text: 'Lessons'),
            Tab(icon: Icon(Icons.assignment), text: 'Exams'),
            Tab(icon: Icon(Icons.people), text: 'Students'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildOverviewTab(),
          _buildLessonsTab(),
          _buildExamsTab(),
          _buildStudentsTab(),
        ],
      ),
    );
  }

  Widget _buildOverviewTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Course Image
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              widget.course.thumbnail,
              height: 200,
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) => Container(
                height: 200,
                color: Colors.grey[300],
                child: const Icon(Icons.image, size: 80),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Status Badge
          Row(
            children: [
              _buildStatusBadge(widget.course.status),
              const SizedBox(width: 8),
              if (widget.course.isFree)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'FREE',
                    style: TextStyle(
                      color: Colors.green,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),

          // Title & Description
          Text(
            widget.course.title,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            widget.course.description,
            style: TextStyle(fontSize: 14, color: Colors.grey[700]),
          ),
          const SizedBox(height: 24),

          // Stats Cards
          Row(
            children: [
              Expanded(child: _buildStatCard('Students', '${widget.course.enrolledCount}', Icons.people, Colors.blue)),
              const SizedBox(width: 12),
              Expanded(child: _buildStatCard('Modules', '${widget.course.modules.length}', Icons.folder, Colors.orange)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _buildStatCard('Rating', widget.course.rating.toStringAsFixed(1), Icons.star, Colors.amber)),
              const SizedBox(width: 12),
              Expanded(child: _buildStatCard('Reviews', '${widget.course.reviewCount}', Icons.rate_review, Colors.purple)),
            ],
          ),
          const SizedBox(height: 24),

          // Course Info
          _buildInfoSection('Course Information', [
            _buildInfoRow('Level', widget.course.level.toUpperCase()),
            _buildInfoRow('Language', widget.course.language),
            _buildInfoRow('Duration', '${widget.course.duration} hours'),
            _buildInfoRow('Price', widget.course.isFree ? 'Free' : '₹${widget.course.price}'),
          ]),
          const SizedBox(height: 16),

          // What You'll Learn
          if (widget.course.whatYouWillLearn.isNotEmpty) ...[
            _buildInfoSection('What You\'ll Learn', [
              ...widget.course.whatYouWillLearn.map((item) => 
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.check_circle, size: 20, color: Colors.green),
                      const SizedBox(width: 8),
                      Expanded(child: Text(item)),
                    ],
                  ),
                ),
              ),
            ]),
            const SizedBox(height: 16),
          ],

          // Requirements
          if (widget.course.requirements.isNotEmpty) ...[
            _buildInfoSection('Requirements', [
              ...widget.course.requirements.map((item) => 
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.circle, size: 8, color: Colors.grey),
                      const SizedBox(width: 8),
                      Expanded(child: Text(item)),
                    ],
                  ),
                ),
              ),
            ]),
          ],

          const SizedBox(height: 24),
          
          // Action Buttons
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                // Edit course
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Edit course functionality')),
                );
              },
              icon: const Icon(Icons.edit),
              label: const Text('Edit Course'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLessonsTab() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          color: Colors.grey[100],
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '${widget.course.modules.length} Modules',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => ManageLessonsScreen(course: widget.course),
                    ),
                  );
                },
                icon: const Icon(Icons.manage_search, size: 18),
                label: const Text('Manage'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: widget.course.modules.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.video_library_outlined, size: 80, color: Colors.grey[300]),
                      const SizedBox(height: 16),
                      Text('No modules yet', style: TextStyle(color: Colors.grey[600])),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: widget.course.modules.length,
                  itemBuilder: (context, index) {
                    final module = widget.course.modules[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: AppColors.primary.withOpacity(0.1),
                          child: Text('${index + 1}', style: TextStyle(color: AppColors.primary)),
                        ),
                        title: Text(module.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: module.description.isNotEmpty ? Text(module.description) : null,
                        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => ManageLessonsScreen(course: widget.course),
                            ),
                          );
                        },
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildExamsTab() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          color: Colors.grey[100],
          child: Row(
            children: [
              const Expanded(
                child: Text(
                  'Course Exams & Quizzes',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => ManageExamsScreen(course: widget.course),
                    ),
                  );
                },
                icon: const Icon(Icons.manage_search, size: 18),
                label: const Text('Manage'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.assignment_outlined, size: 80, color: Colors.grey[300]),
                const SizedBox(height: 16),
                Text('Manage exams in the Exams tab', style: TextStyle(color: Colors.grey[600])),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => ManageExamsScreen(course: widget.course),
                      ),
                    );
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Go to Exams'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStudentsTab() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.people_outline, size: 80, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text('${widget.course.enrolledCount} Students Enrolled', 
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Student management coming soon', style: TextStyle(color: Colors.grey[600])),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color;
    String label;

    switch (status) {
      case 'published':
        color = Colors.green;
        label = 'PUBLISHED';
        break;
      case 'draft':
        color = Colors.orange;
        label = 'DRAFT';
        break;
      case 'archived':
        color = Colors.grey;
        label = 'ARCHIVED';
        break;
      default:
        color = Colors.blue;
        label = status.toUpperCase();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, size: 32, color: color),
            const SizedBox(height: 8),
            Text(
              value,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(fontSize: 12, color: Colors.grey[600]),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        ...children,
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey[600])),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}