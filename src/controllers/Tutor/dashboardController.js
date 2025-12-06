import Course from '../../models/Course.js';
import Tutor from '../../models/Tutor.js';
import Appointment from '../../models/Appointment.js';
import Enrollment from '../../models/Enrollment.js';

// @desc    Get tutor dashboard statistics
// @route   GET /api/dashboard/stats
export const getTutorStats = async (req, res) => {
  try {
    // Find tutor profile
    const tutor = await Tutor.findOne({ userId: req.user.id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    // Get courses statistics
    const totalCourses = await Course.countDocuments({ tutorId: tutor._id });
    const publishedCourses = await Course.countDocuments({
      tutorId: tutor._id,
      status: 'published',
    });
    const draftCourses = await Course.countDocuments({
      tutorId: tutor._id,
      status: 'draft',
    });

    // Get all courses for this tutor
    const courses = await Course.find({ tutorId: tutor._id });

    // Calculate total enrolled students
    const totalStudents = courses.reduce(
      (sum, course) => sum + course.enrolledCount,
      0
    );

    // Calculate average rating
    const coursesWithRatings = courses.filter(c => c.rating > 0);
    const averageRating =
      coursesWithRatings.length > 0
        ? (
            coursesWithRatings.reduce((sum, c) => sum + c.rating, 0) /
            coursesWithRatings.length
          ).toFixed(1)
        : 0;

    // Get appointments statistics
    const now = new Date();
    const upcomingAppointments = await Appointment.countDocuments({
      tutorId: tutor._id,
      dateTime: { $gte: now },
      status: { $in: ['pending', 'confirmed'] },
    });

    const totalAppointments = await Appointment.countDocuments({
      tutorId: tutor._id,
    });

    const completedAppointments = await Appointment.countDocuments({
      tutorId: tutor._id,
      status: 'completed',
    });

    // Get recent enrollments (last 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentEnrollments = await Enrollment.countDocuments({
      courseId: { $in: courses.map(c => c._id) },
      enrolledAt: { $gte: sevenDaysAgo },
    });

    // Get total revenue (if courses are paid)
    const totalRevenue = courses.reduce(
      (sum, course) => sum + course.price * course.enrolledCount,
      0
    );

    res.status(200).json({
      success: true,
      stats: {
        courses: {
          total: totalCourses,
          published: publishedCourses,
          draft: draftCourses,
        },
        students: {
          total: totalStudents,
          recentEnrollments,
        },
        appointments: {
          total: totalAppointments,
          upcoming: upcomingAppointments,
          completed: completedAppointments,
        },
        rating: {
          average: parseFloat(averageRating),
          totalReviews: courses.reduce((sum, c) => sum + c.reviewCount, 0),
        },
        revenue: {
          total: totalRevenue,
        },
      },
    });
  } catch (error) {
    console.error('Get tutor stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get recent activities
// @route   GET /api/dashboard/activities
export const getRecentActivities = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    // Get courses
    const courses = await Course.find({ tutorId: tutor._id });
    const courseIds = courses.map(c => c._id);

    // Get recent enrollments
    const recentEnrollments = await Enrollment.find({
      courseId: { $in: courseIds },
    })
      .populate('studentId', 'name profileImage')
      .populate('courseId', 'title')
      .sort({ enrolledAt: -1 })
      .limit(10);

    // Get recent appointments
    const recentAppointments = await Appointment.find({
      tutorId: tutor._id,
    })
      .populate('studentId', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      activities: {
        enrollments: recentEnrollments,
        appointments: recentAppointments,
      },
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get earnings overview
// @route   GET /api/dashboard/earnings
export const getEarningsOverview = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const courses = await Course.find({ tutorId: tutor._id });

    // Calculate earnings by course
    const earningsByCourse = courses.map(course => ({
      courseId: course._id,
      title: course.title,
      enrollments: course.enrolledCount,
      price: course.price,
      totalEarnings: course.price * course.enrolledCount,
    }));

    // Calculate monthly earnings (mock data - implement real logic)
    const monthlyEarnings = [];
    const currentDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1
      );
      monthlyEarnings.push({
        month: month.toISOString(),
        earnings: Math.floor(Math.random() * 10000) + 5000, // Replace with real data
      });
    }

    res.status(200).json({
      success: true,
      earnings: {
        byCourse: earningsByCourse,
        monthly: monthlyEarnings,
        total: earningsByCourse.reduce((sum, c) => sum + c.totalEarnings, 0),
      },
    });
  } catch (error) {
    console.error('Get earnings overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};