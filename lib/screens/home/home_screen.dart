import 'dart:async';
import 'package:flutter/material.dart';
import 'package:my_app/providers/notification_provider.dart';
import 'package:my_app/screens/notifications_screen.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/category_provider.dart';
import '../../providers/tutor_provider.dart';
import '../../providers/course_provider.dart';
import '../../utils/constants.dart';
import '../../widgets/category_card.dart';
import '../../widgets/tutor_card.dart';
import '../../widgets/course_card.dart';
import '../categories/categories_screen.dart';
import '../tutors/tutors_screen.dart';
import '../courses/courses_screen.dart';
import '../courses/my_enrollments_screen.dart';
import '../profile/profile_screen.dart';
import '../appointments/appointments_screen.dart';
import '../tutor/tutor_dashboard_screen.dart';
import 'package:badges/badges.dart' as badges;
import 'package:timeago/timeago.dart' as timeago;
import 'dart:ui';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  Timer? _notificationTimer;

  @override
  void initState() {
    super.initState();
    _loadData();

    // ✅ Initial fetch (context safe way)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        Provider.of<NotificationProvider>(context, listen: false)
            .fetchUnreadCount();
      }
    });

    // ✅ Fetch unread count every 30 seconds
    _notificationTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) {
        if (mounted) {
          Provider.of<NotificationProvider>(context, listen: false)
              .fetchUnreadCount();
        }
      },
    );
  }

  @override
  void dispose() {
    _notificationTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadData() async {
    if (!mounted) return;

    final categoryProvider = Provider.of<CategoryProvider>(
      context,
      listen: false,
    );
    final tutorProvider = Provider.of<TutorProvider>(context, listen: false);
    final courseProvider = Provider.of<CourseProvider>(context, listen: false);

    await Future.wait([
      categoryProvider.fetchCategories(),
      tutorProvider.fetchTutors(),
      courseProvider.fetchCourses(),
    ]);
  }

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final userRole = authProvider.user?.role ?? 'student';

    if (userRole == 'tutor') {
      return TutorDashboardScreen();
    } else {
      return _buildStudentNavigation();
    }
  }

  // 👨‍🎓 STUDENT NAVIGATION
  Widget _buildStudentNavigation() {
    final List<Widget> studentScreens = [
      const StudentHomeContent(),
      const CoursesScreen(),
      const MyEnrollmentsScreen(),
      const AppointmentsScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _selectedIndex, children: studentScreens),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: _onItemTapped,
        type: BottomNavigationBarType.fixed,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: Colors.grey,
        selectedFontSize: 12,
        unselectedFontSize: 11,
        elevation: 8,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.explore_outlined),
            activeIcon: Icon(Icons.explore),
            label: 'Explore',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.my_library_books_outlined),
            activeIcon: Icon(Icons.my_library_books),
            label: 'My Learning',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.calendar_today_outlined),
            activeIcon: Icon(Icons.calendar_today),
            label: 'Bookings',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}

// 👨‍🎓 STUDENT HOME CONTENT
class StudentHomeContent extends StatelessWidget {
  const StudentHomeContent({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final categoryProvider = Provider.of<CategoryProvider>(context);
    final tutorProvider = Provider.of<TutorProvider>(context);
    final courseProvider = Provider.of<CourseProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Hello 👋',
              style: TextStyle(fontSize: 14, color: Colors.grey),
            ),
            Text(
              authProvider.user?.name ?? 'User',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        actions: [
          Consumer<NotificationProvider>(
            builder: (context, notificationProvider, child) {
              return badges.Badge(
                badgeContent: Text(
                  notificationProvider.unreadCount > 99
                      ? '99+'
                      : notificationProvider.unreadCount.toString(),
                  style: const TextStyle(color: Colors.white, fontSize: 10),
                ),
                showBadge: notificationProvider.unreadCount > 0,
                badgeStyle: badges.BadgeStyle(
                  badgeColor: Colors.red,
                  padding: const EdgeInsets.all(5),
                ),
                child: IconButton(
                  icon: const Icon(Icons.notifications_outlined),
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const NotificationsScreen(),
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await Future.wait([
            categoryProvider.fetchCategories(),
            tutorProvider.fetchTutors(),
            courseProvider.fetchCourses(),
          ]);
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Search Bar
              GestureDetector(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CoursesScreen()),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.search, color: Colors.grey[600]),
                      const SizedBox(width: 12),
                      Text(
                        'Search courses, tutors...',
                        style: TextStyle(color: Colors.grey[600], fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Hero Banner
              _buildHeroBanner(context),
              const SizedBox(height: 24),

              // Quick Actions
              _buildQuickActions(context),
              const SizedBox(height: 24),

              // Categories Section
              _buildSectionHeader(
                context,
                title: 'Categories',
                onViewAll: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CategoriesScreen()),
                  );
                },
              ),
              const SizedBox(height: 12),

              categoryProvider.isLoading
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(20),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  : categoryProvider.categories.isEmpty
                  ? _buildEmptyState('No categories found', Icons.category)
                  : SizedBox(
                      height: 110,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: categoryProvider.categories.length > 6
                            ? 6
                            : categoryProvider.categories.length,
                        itemBuilder: (context, index) {
                          final category = categoryProvider.categories[index];
                          return CategoryCard(category: category);
                        },
                      ),
                    ),
              const SizedBox(height: 24),

              // ---------------------- POPULAR COURSES ------------------------
              _buildSectionHeader(
                context,
                title: 'Popular Courses',
                onViewAll: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CoursesScreen()),
                  );
                },
              ),
              const SizedBox(height: 14),

              courseProvider.isLoading
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(20),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  : courseProvider.courses.isEmpty
                  ? _buildEmptyState('No courses found', Icons.school)
                  : SizedBox(
                      height:
                          MediaQuery.of(context).size.height *
                          0.33, // responsive height
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        separatorBuilder: (_, __) => const SizedBox(width: 18),

                        itemCount: courseProvider.courses.length.clamp(0, 5),

                        itemBuilder: (context, index) {
                          final course = courseProvider.courses[index];

                          return TweenAnimationBuilder(
                            tween: Tween<double>(begin: 0.0, end: 1.0),
                            duration: Duration(
                              milliseconds: 600 + (index * 120),
                            ),
                            curve: Curves.easeOutExpo,

                            builder: (context, value, child) {
                              final opacity = value.clamp(0.0, 1.0);

                              return Opacity(
                                opacity: opacity,
                                child: Transform.translate(
                                  offset: Offset(40 * (1 - value), 0),
                                  child: Transform.scale(
                                    scale: 0.92 + (0.08 * value),
                                    child: child,
                                  ),
                                ),
                              );
                            },

                            // PREMIUM CARD STYLE
                            child: Container(
                              width: 250,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(20),
                                gradient: LinearGradient(
                                  colors: [
                                    Colors.white.withOpacity(0.85),
                                    Colors.white.withOpacity(0.65),
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.08),
                                    blurRadius: 18,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                                backgroundBlendMode: BlendMode.overlay,
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(20),
                                child: BackdropFilter(
                                  filter: ImageFilter.blur(
                                    sigmaX: 10,
                                    sigmaY: 10,
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: CourseCard(course: course),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),

              const SizedBox(height: 24),

              // ---------------------- TOP TUTORS ------------------------
              _buildSectionHeader(
                context,
                title: 'Top Tutors',
                onViewAll: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const TutorsScreen()),
                  );
                },
              ),
              const SizedBox(height: 14),

              tutorProvider.isLoading
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(20),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  : tutorProvider.tutors.isEmpty
                  ? _buildEmptyState('No tutors found', Icons.person)
                  : ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: tutorProvider.tutors.length.clamp(0, 3),
                      separatorBuilder: (_, __) => const SizedBox(height: 14),
                      itemBuilder: (context, index) {
                        final tutor = tutorProvider.tutors[index];
                        return TutorCard(tutor: tutor);
                      },
                    ),

              const SizedBox(height: 34),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeroBanner(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.accent],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Learn Anything,',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Text(
                  'Anytime, Anywhere',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Connect with expert tutors and courses',
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const CoursesScreen()),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Explore Now',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          const Icon(Icons.school_outlined, size: 90, color: Colors.white24),
        ],
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _buildQuickActionCard(
            context,
            icon: Icons.calendar_today_outlined,
            title: 'My Bookings',
            color: Colors.blue,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AppointmentsScreen()),
              );
            },
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildQuickActionCard(
            context,
            icon: Icons.my_library_books_outlined,
            title: 'My Courses',
            color: Colors.green,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const MyEnrollmentsScreen()),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildQuickActionCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3), width: 1.5),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 32, color: color),
            const SizedBox(height: 8),
            Text(
              title,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: color,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(
    BuildContext context, {
    required String title,
    required VoidCallback onViewAll,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        TextButton(onPressed: onViewAll, child: const Text('View all')),
      ],
    );
  }

  Widget _buildEmptyState(String message, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Column(
          children: [
            Icon(icon, size: 48, color: Colors.grey[400]),
            const SizedBox(height: 8),
            Text(
              message,
              style: TextStyle(color: Colors.grey[600], fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}
