import Course from '../../models/Course.js';
import Tutor from '../../models/Tutor.js';
import Appointment from '../../models/Appointment.js';
import Enrollment from '../../models/Enrollment.js';
import { Exam } from '../../models/Exam.js';
import { QuestionSet } from '../../models/QuestionSet.js';
import LearningEvent from '../../models/LearningEvent.js';
import LearningEventDailyAggregate from '../../models/LearningEventDailyAggregate.js';

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

    // Calculate total enrolled students (Active Students)
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

    // --- NEW STATS FOR DASHBOARD V2 ---

    // 1. Total Quizzes (Exams excluding practice sets)
    const totalQuizzes = await Exam.countDocuments({
      tutorId: tutor._id,
      type: { $ne: 'practice' }
    });

    // 2. Total Practice Sets
    const totalPracticeSets = await Exam.countDocuments({
      tutorId: tutor._id,
      type: 'practice'
    });

    // 3. Total Questions
    // Aggregate questions from QuestionSets
    const questionSets = await QuestionSet.find({ tutorId: tutor._id });
    const questionSetCount = questionSets.reduce((acc, set) => acc + (set.questions ? set.questions.length : 0), 0);

    // Aggregate questions from Exams (that might not be in question sets, or just count all exam questions)
    // To avoid over-complexity/performance issues with massive question banks, we can simplify or use aggregation.
    // For now, let's sum up questions in all exams + question sets. 
    // Note: This might double count if questions are imported, but without a dedicated 'Question' model collection, this is best approximation.
    const allExams = await Exam.find({ tutorId: tutor._id }, 'totalQuestions questions');
    const examQuestionCount = allExams.reduce((acc, exam) => acc + (exam.totalQuestions || exam.questions.length), 0);

    const totalQuestions = questionSetCount + examQuestionCount;


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
        // Enhanced Stats
        content: {
          questions: totalQuestions,
          quizzes: totalQuizzes,
          practiceSets: totalPracticeSets
        }
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


// @desc    Get all students enrolled in tutor's courses
// @route   GET /api/dashboard/students
export const getTutorStudents = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    // Get all courses for this tutor
    const courses = await Course.find({ tutorId: tutor._id });
    const courseIds = courses.map(c => c._id);

    // Get all enrollments with student details
    const enrollments = await Enrollment.find({
      courseId: { $in: courseIds },
      status: 'active',
    })
      .populate('studentId', 'name email phone profileImage')
      .populate('courseId', 'title')
      .sort({ enrolledAt: -1 });

    // Group students by course
    const studentsByCourse = courses.map(course => {
      const courseEnrollments = enrollments.filter(
        e => e.courseId._id.toString() === course._id.toString()
      );

      return {
        courseId: course._id,
        courseTitle: course.title,
        studentCount: courseEnrollments.length,
        students: courseEnrollments.filter(e => e.studentId).map(e => ({
          studentId: e.studentId._id,
          name: e.studentId.name,
          email: e.studentId.email,
          phone: e.studentId.phone,
          profileImage: e.studentId.profileImage,
          enrolledAt: e.enrolledAt,
          progress: e.progress.percentage,
        })),
      };
    });

    // Get unique students
    const uniqueStudents = [];
    const studentIds = new Set();

    enrollments.forEach(e => {
      // Defensive check: If student was deleted but enrollment remains
      if (!e.studentId || !e.studentId._id) return;

      if (!studentIds.has(e.studentId._id.toString())) {
        studentIds.add(e.studentId._id.toString());
        const isBlockedByTutor = tutor.blockedStudents?.some(
          bId => bId.toString() === e.studentId._id.toString()
        ) || false;
        uniqueStudents.push({
          _id: e.studentId._id,
          studentId: e.studentId._id,
          name: e.studentId.name,
          email: e.studentId.email,
          phone: e.studentId.phone,
          profileImage: e.studentId.profileImage,
          isBlockedByTutor,
          joinedAt: e.studentId.createdAt,
          enrolledCourses: enrollments.filter(
            en => en.studentId && en.studentId._id.toString() === e.studentId._id.toString()
          ).map(en => ({
            courseId: en.courseId._id,
            title: en.courseId.title
          }))
        });
      }
    });

    res.status(200).json({
      success: true,
      totalStudents: uniqueStudents.length,
      students: uniqueStudents,
      byCourse: studentsByCourse,
    });
  } catch (error) {
    console.error('Get tutor students error:', error);
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

    // Calculate monthly earnings using aggregation
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);

    const monthlyEarningsAgg = await Enrollment.aggregate([
      {
        $match: {
          courseId: { $in: courses.map(c => c._id) },
          enrolledAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      {
        $unwind: '$course'
      },
      {
        $group: {
          _id: {
            year: { $year: '$enrolledAt' },
            month: { $month: '$enrolledAt' }
          },
          earnings: { $sum: '$course.price' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Format for frontend (ensure last 6 months exist even if 0 earnings)
    const monthlyEarnings = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth() + 1; // 1-based

      const found = monthlyEarningsAgg.find(m => m._id.year === year && m._id.month === month);

      monthlyEarnings.push({
        name: d.toLocaleString('default', { month: 'short' }), // Jan, Feb
        revenue: found ? found.earnings : 0,
        month: d.toISOString()
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

// @desc    Get student engagement/performance metrics (for chart)
// @route   GET /api/dashboard/performance
export const getStudentPerformance = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const courses = await Course.find({ tutorId: tutor._id }).select('_id').lean();
    const courseIds = courses.map((course) => course._id);
    if (courseIds.length === 0) {
      return res.status(200).json({
        success: true,
        performance: [],
      });
    }

    const trackedEventTypes = ['exam_submitted', 'assignment_submitted', 'live_class_joined', 'attendance_marked'];

    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const todayUtcKey = now.toISOString().split('T')[0];
    const todayUtcStart = new Date(`${todayUtcKey}T00:00:00.000Z`);

    const historicalDailyRows = await LearningEventDailyAggregate.find({
      courseId: { $in: courseIds },
      eventType: { $in: trackedEventTypes },
      date: {
        $gte: new Date(startDate.toISOString().split('T')[0] + 'T00:00:00.000Z'),
        $lt: todayUtcStart,
      },
    }).select('date eventType count').lean();

    const todayRows = await LearningEvent.aggregate([
      {
        $match: {
          courseId: { $in: courseIds },
          createdAt: { $gte: todayUtcStart, $lte: now },
          eventType: { $in: trackedEventTypes },
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'UTC',
              },
            },
            eventType: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const uniqueStudentRows = await LearningEvent.aggregate([
      {
        $match: {
          courseId: { $in: courseIds },
          createdAt: { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$createdAt',
                timezone: 'UTC',
              },
            },
          },
          uniqueStudents: { $addToSet: '$userId' },
        },
      },
    ]);

    const dayMap = new Map();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayKey = d.toISOString().split('T')[0];
      dayMap.set(dayKey, {
        name: d.toLocaleString('default', { weekday: 'short' }),
        students: 0,
        quizzes: 0,
        assignments: 0,
        liveClasses: 0,
        attendance: 0,
      });
    }

    historicalDailyRows.forEach((row) => {
      const dayKey = new Date(row.date).toISOString().split('T')[0];
      const dayEntry = dayMap.get(dayKey);
      if (!dayEntry) return;

      if (row.eventType === 'exam_submitted') dayEntry.quizzes += row.count;
      if (row.eventType === 'assignment_submitted') dayEntry.assignments += row.count;
      if (row.eventType === 'live_class_joined') dayEntry.liveClasses += row.count;
      if (row.eventType === 'attendance_marked') dayEntry.attendance += row.count;
    });

    todayRows.forEach((row) => {
      const dayKey = row._id.day;
      const dayEntry = dayMap.get(dayKey);
      if (!dayEntry) return;

      if (row._id.eventType === 'exam_submitted') dayEntry.quizzes += row.count;
      if (row._id.eventType === 'assignment_submitted') dayEntry.assignments += row.count;
      if (row._id.eventType === 'live_class_joined') dayEntry.liveClasses += row.count;
      if (row._id.eventType === 'attendance_marked') dayEntry.attendance += row.count;
    });

    const uniqueByDay = new Map();
    uniqueStudentRows.forEach((row) => {
      const daySet = new Set(
        (row.uniqueStudents || [])
          .filter(Boolean)
          .map((studentId) => studentId.toString())
      );
      uniqueByDay.set(row._id.day, daySet);
    });

    const performanceData = Array.from(dayMap.entries()).map(([dayKey, data]) => {
      const uniqueStudents = uniqueByDay.get(dayKey);
      return {
        ...data,
        students: uniqueStudents ? uniqueStudents.size : 0,
      };
    });

    res.status(200).json({
      success: true,
      performance: performanceData
    });

  } catch (error) {
    console.error('Get performance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Block a student (tutor-level)
// @route   POST /api/tutor/dashboard/students/:studentId/block
export const blockStudent = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });
    if (!tutor) {
      return res.status(403).json({ success: false, message: 'Only tutors can access this endpoint' });
    }

    const { studentId } = req.params;

    // Check if already blocked
    if (tutor.blockedStudents?.includes(studentId)) {
      return res.status(400).json({ success: false, message: 'Student is already blocked' });
    }

    tutor.blockedStudents = tutor.blockedStudents || [];
    tutor.blockedStudents.push(studentId);
    await tutor.save();

    res.status(200).json({ success: true, message: 'Student blocked successfully' });
  } catch (error) {
    console.error('Block student error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Unblock a student (tutor-level)
// @route   POST /api/tutor/dashboard/students/:studentId/unblock
export const unblockStudent = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });
    if (!tutor) {
      return res.status(403).json({ success: false, message: 'Only tutors can access this endpoint' });
    }

    const { studentId } = req.params;

    tutor.blockedStudents = (tutor.blockedStudents || []).filter(
      id => id.toString() !== studentId
    );
    await tutor.save();

    res.status(200).json({ success: true, message: 'Student unblocked successfully' });
  } catch (error) {
    console.error('Unblock student error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
