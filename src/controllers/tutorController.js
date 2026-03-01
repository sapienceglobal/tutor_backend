import Tutor from '../models/Tutor.js';
import User from '../models/User.js';
import Category from '../models/Category.js';

// @desc    Get all tutors with filters
// @route   GET /api/tutors
export const getAllTutors = async (req, res) => {
  try {
    const { categoryId, minRating, maxRate, search } = req.query;

    // Build filter object - Only show approved/verified tutors to students
    let filter = { isVerified: true };

    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (minRating) {
      filter.rating = { $gte: parseFloat(minRating) };
    }

    if (maxRate) {
      filter.hourlyRate = { $lte: parseFloat(maxRate) };
    }

    // If an authenticated student is making this request, exclude tutors who blocked them
    if (req.user && req.user.role === 'student') {
      filter.blockedStudents = { $ne: req.user._id };
    }

    const tutors = await Tutor.find(filter)
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon')
      .sort({ rating: -1, studentsCount: -1 });

    // Search by name if provided
    let filteredTutors = tutors;
    if (search) {
      filteredTutors = tutors.filter(tutor =>
        tutor.userId && tutor.userId.name && tutor.userId.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.status(200).json({
      success: true,
      count: filteredTutors.length,
      tutors: filteredTutors
    });
  } catch (error) {
    console.error('Get tutors error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get single tutor by ID
// @route   GET /api/tutors/:id
export const getTutorById = async (req, res) => {
  try {
    const { id } = req.params;

    const tutor = await Tutor.findById(id)
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon description');

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found'
      });
    }

    // DB-level check: If authenticated student is blocked by this tutor, deny access
    if (req.user && req.user.role === 'student') {
      const isBlocked = tutor.blockedStudents?.some(
        bId => bId.toString() === req.user._id.toString()
      );
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to view this tutor'
        });
      }
    }

    res.status(200).json({
      success: true,
      tutor
    });
  } catch (error) {
    console.error('Get tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get tutors by category
// @route   GET /api/tutors/category/:categoryId
export const getTutorsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const tutors = await Tutor.find({ categoryId, isVerified: true })
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon')
      .sort({ rating: -1 });

    res.status(200).json({
      success: true,
      category: category.name,
      count: tutors.length,
      tutors
    });
  } catch (error) {
    console.error('Get tutors by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Create tutor profile
// @route   POST /api/tutors
export const createTutor = async (req, res) => {
  try {
    const {
      categoryId,
      hourlyRate,
      experience,
      subjects,
      availability,
      bio
    } = req.body;

    if (!categoryId || !hourlyRate || !experience) {
      return res.status(400).json({
        success: false,
        message: 'Category, hourly rate, and experience are required'
      });
    }

    // Check if user already has a tutor profile
    const existingTutor = await Tutor.findOne({ userId: req.user.id });
    if (existingTutor) {
      return res.status(400).json({
        success: false,
        message: 'Tutor profile already exists'
      });
    }

    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const tutor = await Tutor.create({
      userId: req.user.id,
      categoryId,
      hourlyRate,
      experience,
      subjects: subjects || [],
      availability: availability || [],
      bio: bio || '',
      title: req.body.title || '',
      website: req.body.website || '',
      location: req.body.location || ''
    });

    // Update user role to tutor
    await User.findByIdAndUpdate(req.user.id, { role: 'tutor' });

    // Update category tutor count
    category.tutorCount += 1;
    await category.save();

    const populatedTutor = await Tutor.findById(tutor._id)
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon');

    res.status(201).json({
      success: true,
      message: 'Tutor profile created successfully',
      tutor: populatedTutor
    });
  } catch (error) {
    console.error('Create tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Update tutor profile
// @route   PATCH /api/tutors/:id
export const updateTutor = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      categoryId,
      hourlyRate,
      experience,
      subjects,
      availability,
      bio
    } = req.body;

    const tutor = await Tutor.findById(id);

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found'
      });
    }

    // Check if user owns this tutor profile
    if (tutor.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }

    if (categoryId) tutor.categoryId = categoryId;
    if (hourlyRate) tutor.hourlyRate = hourlyRate;
    if (experience) tutor.experience = experience;
    if (subjects) tutor.subjects = subjects;
    if (availability) tutor.availability = availability;
    if (availability) tutor.availability = availability;
    if (bio) tutor.bio = bio;
    if (req.body.title) tutor.title = req.body.title;
    if (req.body.website) tutor.website = req.body.website;
    if (req.body.location) tutor.location = req.body.location;

    await tutor.save();

    const updatedTutor = await Tutor.findById(id)
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon');

    res.status(200).json({
      success: true,
      message: 'Tutor profile updated successfully',
      tutor: updatedTutor
    });
  } catch (error) {
    console.error('Update tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Delete tutor profile
// @route   DELETE /api/tutors/:id
export const deleteTutor = async (req, res) => {
  try {
    const { id } = req.params;

    const tutor = await Tutor.findById(id);

    if (!tutor) {
      return res.status(404).json({
        success: false,
        message: 'Tutor not found'
      });
    }

    // Check if user owns this tutor profile
    if (tutor.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this profile'
      });
    }

    // Update category tutor count
    const category = await Category.findById(tutor.categoryId);
    if (category) {
      category.tutorCount = Math.max(0, category.tutorCount - 1);
      await category.save();
    }

    await tutor.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Tutor profile deleted successfully'
    });
  } catch (error) {
    console.error('Delete tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get current logged in tutor profile
// @route   GET /api/tutors/profile
export const getCurrentTutor = async (req, res) => {
  try {
    let tutor = await Tutor.findOne({ userId: req.user.id })
      .populate('userId', 'name email phone profileImage')
      .populate('categoryId', 'name icon');

    if (!tutor) {
      if (req.user.role === 'tutor') {
        tutor = await Tutor.create({ userId: req.user.id });
        tutor = await Tutor.findById(tutor._id)
          .populate('userId', 'name email phone profileImage')
          .populate('categoryId', 'name icon');
      } else {
        return res.status(404).json({
          success: false,
          message: 'Tutor profile not found'
        });
      }
    }

    // Get course count
    // Dynamic import to avoid circular dependency if Course imports Tutor
    const Course = (await import('../models/Course.js')).default;
    const courseCount = await Course.countDocuments({ tutorId: tutor._id });

    // Return tutor object converted to object + courseCount
    const tutorObj = tutor.toObject();
    tutorObj.courseCount = courseCount;

    res.status(200).json({
      success: true,
      tutor: tutorObj
    });
  } catch (error) {
    console.error('Get current tutor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get tutor stats (dashboard)
// @route   GET /api/tutors/stats
export const getTutorStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get Tutor Profile
    let tutor = await Tutor.findOne({ userId });
    if (!tutor) {
      if (req.user.role === 'tutor') {
        tutor = await Tutor.create({ userId });
      } else {
        return res.status(404).json({ success: false, message: 'Tutor profile not found' });
      }
    }

    // 2. Get Courses
    // Dynamic import to avoid circular dependency
    const Course = (await import('../models/Course.js')).default;
    const courses = await Course.find({ tutorId: tutor._id });
    const courseIds = courses.map(c => c._id);

    const activeCourses = courses.filter(c => c.status === 'published').length;
    const totalCourses = courses.length;

    // 3. Get Enrollments (Total Students & Earnings)
    const Enrollment = (await import('../models/Enrollment.js')).default;
    const enrollments = await Enrollment.find({ courseId: { $in: courseIds } })
      .populate('studentId', 'name email profileImage')
      .populate('courseId', 'title price thumbnail')
      .sort({ enrolledAt: -1 });

    // Calculate Total Earnings
    const totalEarnings = enrollments.reduce((sum, enrollment) => {
      return sum + (enrollment.courseId?.price || 0);
    }, 0);

    // Calculate Unique Students
    const uniqueStudents = new Set(enrollments.map(e => e.studentId?._id.toString())).size;

    // 4. Calculate Ratings & Distribution
    const totalRatings = courses.reduce((sum, course) => sum + (course.rating || 0), 0);
    const avgRating = totalCourses > 0 ? (totalRatings / totalCourses).toFixed(1) : 0;

    // Get Reviews for Ratings Distribution
    // Dynamic import to avoid circular dependency
    const Review = (await import('../models/Review.js')).default;
    // Assuming Review model has courseId field and courseIds are available
    const reviews = await Review.find({ courseId: { $in: courseIds } });

    const ratingsDistribution = {
      5: 0, 4: 0, 3: 0, 2: 0, 1: 0
    };

    reviews.forEach(review => {
      const rating = Math.round(review.rating); // Assuming rating is 1-5
      if (ratingsDistribution[rating] !== undefined) {
        ratingsDistribution[rating]++;
      }
    });

    // Helper to check if date is in current or last month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const isCurrentMonth = (date) => {
      const d = new Date(date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    };
    const isLastMonth = (date) => {
      const d = new Date(date);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    };

    // --- Trend Calculations ---

    // 1. Students Trend
    // We need unique students from enrollments in current month vs last month
    // Note: This is an approximation. Ideally we'd query by enrollment date grouping.
    const currentMonthStudents = new Set(enrollments.filter(e => isCurrentMonth(e.enrolledAt)).map(e => e.studentId?._id.toString()));
    const lastMonthStudents = new Set(enrollments.filter(e => isLastMonth(e.enrolledAt)).map(e => e.studentId?._id.toString()));

    // Calculate percentage change
    const calculateTrend = (current, previous) => {
      if (previous === 0) {
        // If current is also 0, no change. If current > 0, it's distinct growth (New). 
        // Return null to indicate "New" or "No Baseline"
        return current === 0 ? 0 : null;
      }
      return ((current - previous) / previous) * 100;
    };

    const studentTrend = calculateTrend(currentMonthStudents.size, lastMonthStudents.size);

    // 2. Earnings Trend
    const currentMonthEarnings = enrollments.filter(e => isCurrentMonth(e.enrolledAt)).reduce((sum, e) => sum + (e.courseId?.price || 0), 0);
    const lastMonthEarnings = enrollments.filter(e => isLastMonth(e.enrolledAt)).reduce((sum, e) => sum + (e.courseId?.price || 0), 0);
    const earningsTrend = calculateTrend(currentMonthEarnings, lastMonthEarnings);

    // 3. Courses Trend (Newly published)
    const currentMonthCourses = courses.filter(c => c.status === 'published' && isCurrentMonth(c.createdAt)).length;
    const lastMonthCourses = courses.filter(c => c.status === 'published' && isLastMonth(c.createdAt)).length;
    const coursesTrend = calculateTrend(currentMonthCourses, lastMonthCourses);

    // 4. Ratings Trend (New ratings avg vs old doesn't make sense, maybe just count of new ratings?)
    // Let's do Average Rating change if possible, otherwise count of new reviews
    const currentMonthReviews = reviews.filter(r => isCurrentMonth(r.createdAt));
    const lastMonthReviews = reviews.filter(r => isLastMonth(r.createdAt));

    // Review count trend for now, as avg rating fluctuation is minimal
    const reviewsTrend = calculateTrend(currentMonthReviews.length, lastMonthReviews.length);


    // 5. Recent Enrollments (Last 5)
    const recentEnrollments = enrollments.slice(0, 5).map(e => ({
      _id: e._id,
      studentName: e.studentId?.name || 'Unknown',
      studentImage: e.studentId?.profileImage,
      studentId: e.studentId?._id,
      courseTitle: e.courseId?.title || 'Unknown Course',
      price: e.courseId?.price || 0,
      enrolledAt: e.enrolledAt
    }));

    // 6. Top Courses (by enrollment count)
    const topCourses = courses
      .sort((a, b) => b.enrolledCount - a.enrolledCount)
      .slice(0, 5)
      .map(c => ({
        id: c._id,
        name: c.title,
        count: c.enrolledCount.toLocaleString(),
        trend: (c.rating || 0).toFixed(1),
        trendUp: true,
        bg: 'bg-blue-100',
        color: 'text-blue-600'
      }));

    // 7. Monthly Data (Last 12 months)
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return {
        name: d.toLocaleString('default', { month: 'short' }),
        students: 0,    // Previously 'website'
        enrollments: 0  // Previously 'user'
      };
    }).reverse();

    enrollments.forEach(e => {
      const date = new Date(e.enrolledAt);
      const monthName = date.toLocaleString('default', { month: 'short' });
      const monthParams = monthlyData.find(m => m.name === monthName);
      if (monthParams) {
        monthParams.enrollments += 1;
        // For 'students' in the chart, we could show Total Active or Revenue. 
        // Let's us 'students' to represent Revenue (scaled / 10 for visibility) or just use separate logic.
        // Actually, looking at the Chart component, it expects 'students' and 'enrollments'.
        // Let's make 'students' = Revenue ($) and 'enrollments' = Count.
        // But better: 'students' = New Students, 'enrollments' = Course Sales.
        // For now, let's map: students -> unique students joined that month. enrollments -> total sales count.
        monthParams.students += 1; // Simplification: 1 enrollment = 1 student interaction
      }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalStudents: uniqueStudents,
        activeCourses,
        totalEarnings,
        avgRating,
        recentEnrollments,
        topCourses,
        monthlyData,
        ratingsDistribution,
        totalReviews: reviews.length,
        trends: {
          students: studentTrend,
          courses: coursesTrend,
          earnings: earningsTrend,
          reviews: reviewsTrend
        },
        isVerified: tutor.isVerified
      }
    });

  } catch (error) {
    console.error('Get tutor stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Get student details for tutor (specific to tutor's courses)
// @route   GET /api/tutors/students/:id
export const getTutorStudentDetails = async (req, res) => {
  try {
    const { id } = req.params; // Student ID
    const userId = req.user.id; // Tutor ID (User ID)

    const tutor = await Tutor.findOne({ userId });
    if (!tutor) return res.status(404).json({ success: false, message: 'Tutor profile not found' });

    const student = await User.findById(id).select('name email phone profileImage bio address joinedAt createdAt');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Find courses created by this tutor
    // Dynamic import to avoid circular dependency if needed, but imported at top? No, dynamic used in other functions.
    // Let's use dynamic for consistency if imports are issues throughout file.
    const Course = (await import('../models/Course.js')).default;
    const courses = await Course.find({ tutorId: tutor._id });
    const courseIds = courses.map(c => c._id);

    // Find enrollments of this student in these courses
    const Enrollment = (await import('../models/Enrollment.js')).default;
    const enrollments = await Enrollment.find({
      studentId: id,
      courseId: { $in: courseIds }
    }).populate('courseId', 'title price thumbnail level category status')
      .sort({ enrolledAt: -1 });

    const totalSpent = enrollments.reduce((sum, enr) => sum + (enr.courseId?.price || 0), 0);

    res.status(200).json({
      success: true,
      student,
      enrollments,
      totalSpent,
      tutorCoursesCount: enrollments.length
    });

  } catch (error) {
    console.error('Get tutor student details error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};