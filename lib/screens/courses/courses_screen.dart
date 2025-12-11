import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/course_provider.dart';
import '../../widgets/course_card.dart';
import '../../utils/constants.dart';

class CoursesScreen extends StatefulWidget {
  const CoursesScreen({super.key});

  @override
  State<CoursesScreen> createState() => _CoursesScreenState();
}

class _CoursesScreenState extends State<CoursesScreen> {
  String _selectedLevel = 'all';
  bool _showFreeOnly = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CourseProvider>(context, listen: false).fetchCourses();
    });
  }

  @override
  Widget build(BuildContext context) {
    final courseProvider = Provider.of<CourseProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('All Courses'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () => _showFilterBottomSheet(context),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search courses...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.grey[100],
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (value) {
                courseProvider.searchCourses(value);
              },
            ),
          ),

          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _buildFilterChip('All Levels', 'all'),
                const SizedBox(width: 8),
                _buildFilterChip('Beginner', 'beginner'),
                const SizedBox(width: 8),
                _buildFilterChip('Intermediate', 'intermediate'),
                const SizedBox(width: 8),
                _buildFilterChip('Advanced', 'advanced'),
                const SizedBox(width: 8),
                FilterChip(
                  label: const Text('Free Only'),
                  selected: _showFreeOnly,
                  onSelected: (selected) {
                    setState(() {
                      _showFreeOnly = selected;
                    });
                    courseProvider.filterByPrice(selected);
                  },
                  selectedColor: AppColors.primary.withOpacity(0.2),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Courses List
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => courseProvider.fetchCourses(),
              child: courseProvider.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : courseProvider.courses.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.school_outlined,
                                size: 80,
                                color: Colors.grey[300],
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'No courses found',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: Colors.grey[600],
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: courseProvider.courses.length,
                          itemBuilder: (context, index) {
                            final course = courseProvider.courses[index];
                            return CourseCard(course: course);
                          },
                        ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    return FilterChip(
      label: Text(label),
      selected: _selectedLevel == value,
      onSelected: (selected) {
        setState(() {
          _selectedLevel = value;
        });
        Provider.of<CourseProvider>(context, listen: false)
            .filterByLevel(value);
      },
      selectedColor: AppColors.primary.withOpacity(0.2),
    );
  }

  void _showFilterBottomSheet(BuildContext context) {
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Filter Courses',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              const Text('Level:'),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                children: [
                  _buildFilterChip('All', 'all'),
                  _buildFilterChip('Beginner', 'beginner'),
                  _buildFilterChip('Intermediate', 'intermediate'),
                  _buildFilterChip('Advanced', 'advanced'),
                ],
              ),
              const SizedBox(height: 16),
              SwitchListTile(
                title: const Text('Show Free Courses Only'),
                value: _showFreeOnly,
                onChanged: (value) {
                  setState(() {
                    _showFreeOnly = value;
                  });
                  Provider.of<CourseProvider>(context, listen: false)
                      .filterByPrice(value);
                  Navigator.pop(context);
                },
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    setState(() {
                      _selectedLevel = 'all';
                      _showFreeOnly = false;
                    });
                    Provider.of<CourseProvider>(context, listen: false)
                        .clearFilters();
                    Navigator.pop(context);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.grey[300],
                    foregroundColor: Colors.black,
                  ),
                  child: const Text('Clear Filters'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}