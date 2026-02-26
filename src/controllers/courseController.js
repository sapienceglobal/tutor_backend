import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Enrollment from '../models/Enrollment.js';
import Tutor from '../models/Tutor.js';
import Settings from '../models/Settings.js';
import jwt from 'jsonwebtoken';

// @desc    Get all published courses
// @route   GET /api/courses
export const getAllCourses = async (req, res) => {
  try {

    const { categoryId, level, isFree, search, tutorId } = req.query;

    // Check Guest Browsing Settings
    const settings = await Settings.findOne();
    if (settings && settings.allowGuestBrowsing === false) {
      let token;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Guest browsing is currently disabled. Please log in to view courses.'
        });
      }

      try {
        jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please log in to view courses.'
        });
      }
    }

    let filter = { status: 'published' };

    if (categoryId) filter.categoryId = categoryId;
    if (level) filter.level = level;
    if (isFree !== undefined) filter.isFree = isFree === 'true';
    if (tutorId) filter.tutorId = tutorId;

    let courses = await Course.find(filter)
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        populate: {
          path: 'userId',
          select: 'name profileImage isBlocked',
        },
      })
      .sort({ createdAt: -1 });

    // Filter out courses with unverified/blocked tutors
    courses = courses.filter(course => {
      const isTutorVerified = course.tutorId && course.tutorId.isVerified;
      const isUserBlocked = course.tutorId && course.tutorId.userId && course.tutorId.userId.isBlocked;
      return isTutorVerified && !isUserBlocked;
    });

    // Search by title
    if (search) {
      courses = courses.filter(course =>
        course.title.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get single course
// @route   GET /api/courses/:id
export const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id)
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        populate: {
          path: 'userId',
          select: 'name email phone profileImage',
        },
      });

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if user is enrolled (if authenticated)
    let isEnrolled = false;
    let isInstructor = false;
    
    if (req.user) {
      const enrollment = await Enrollment.findOne({
        studentId: req.user.id,
        courseId: id,
      });
      isEnrolled = !!enrollment;

      if (req.user.role === 'tutor' && course.tutorId?.userId?._id?.toString() === req.user.id) {
        isInstructor = true;
      }
    }

    // Determine if the course is publicly available
    // A course is available if it's published AND its tutor is verified/not blocked
    const isTutorVerified = course.tutorId && course.tutorId.isVerified;
    const isTutorBlocked = course.tutorId && course.tutorId.userId && course.tutorId.userId.isBlocked;
    const isCourseAvailable = course.status === 'published' && isTutorVerified && !isTutorBlocked;

    // Security: Strict Role-Based Access Control
    // 1. Tutors can ONLY access their own courses (unless they somehow enrolled as a student, but tutors shouldn't act as students).
    if (req.user && req.user.role === 'tutor' && !isInstructor) {
        return res.status(403).json({
          success: false,
          message: `Access Denied: Tutors can only preview their own created courses.`,
        });
    }

    // Security: Block access to unavailable courses for non-enrolled students
    if (!isCourseAvailable) {
      let canAccess = false;
      if (req.user) {
        if (req.user.role === 'admin') canAccess = true;
        // Check if user is the tutor who created the course
        if (isInstructor) {
          canAccess = true;
        }
        // Check if user is already enrolled (retain access principle)
        if (isEnrolled) {
          canAccess = true;
        }
      }

      if (!canAccess) {
        return res.status(403).json({
          success: false,
          message: `This course is currently unavailable or suspended, and cannot be accessed.`,
        });
      }
    }

    // Get lessons for this course
    const lessons = await Lesson.find({ courseId: id, isPublished: true })
      .sort({ order: 1 });

    res.status(200).json({
      success: true,
      course,
      lessons,
      isEnrolled,
      isInstructor,
    });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Create course (Tutor only)
// @route   POST /api/courses
export const createCourse = async (req, res) => {
  try {
    const {
      title,
      description,
      thumbnail,
      categoryId,
      price,
      level,
      duration,
      language,
      modules,
      requirements,
      whatYouWillLearn,
    } = req.body;

    if (!title || !description || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and category are required',
      });
    }

    // Get tutor profile
    const tutor = await Tutor.findOne({ userId: req.user.id });
    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can create courses',
      });
    }

    const course = await Course.create({
      title,
      description,
      thumbnail,
      categoryId,
      tutorId: tutor._id,
      price: price || 0,
      level: level || 'beginner',
      duration: duration || 0,
      language: language || 'English',
      modules: modules || [],
      requirements: requirements || [],
      whatYouWillLearn: whatYouWillLearn || [],
    });

    const populatedCourse = await Course.findById(course._id)
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        populate: {
          path: 'userId',
          select: '-password name profileImage',
        },
      });

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      course: populatedCourse,
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Update course (Tutor only - own courses)
// @route   PATCH /api/courses/:id
export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id).populate('tutorId');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if user owns this course
    if (course.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this course',
      });
    }

    const allowedUpdates = [
      'title', 'description', 'thumbnail', 'categoryId',
      'price', 'level', 'duration', 'language', 'modules',
      'requirements', 'whatYouWillLearn', 'status',
    ];

    // Intercept Publish Request based on Admin Auto-Approve Setting
    if (req.body.status === 'published') {
      const settings = await Settings.findOne();
      if (settings && settings.autoApproveCourses === false) {
        // Force status to pending if auto-approve is disabled
        req.body.status = 'pending';
      }
    }

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        course[field] = req.body[field];
      }
    });

    await course.save();

    const updatedCourse = await Course.findById(id)
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        populate: {
          path: 'userId',
          select: '-password name profileImage',
        },
      });

    res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      course: updatedCourse,
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Delete course (Tutor only - own courses)
// @route   DELETE /api/courses/:id
export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await Course.findById(id).populate('tutorId');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if user owns this course
    if (course.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this course',
      });
    }

    // Check if course has enrollments
    const enrollmentCount = await Enrollment.countDocuments({ courseId: id });
    if (enrollmentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete course. ${enrollmentCount} students are enrolled`,
      });
    }

    // Delete all lessons
    await Lesson.deleteMany({ courseId: id });

    await course.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Course deleted successfully',
    });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get courses by tutor
// @route   GET /api/courses/tutor/:tutorId
export const getCoursesByTutor = async (req, res) => {
  try {
    const { tutorId } = req.params;

    const courses = await Course.find({ tutorId, status: 'published' })
      .populate('categoryId', 'name icon')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
    });
  } catch (error) {
    console.error('Get tutor courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get my courses (Tutor's own courses)
// @route   GET /api/courses/my-courses
export const getMyCourses = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });

    if (!tutor) {
      return res.status(403).json({
        success: false,
        message: 'Only tutors can access this endpoint',
      });
    }

    const courses = await Course.find({ tutorId: tutor._id })
      .populate('categoryId', 'name icon')
      .populate({
        path: 'tutorId',
        populate: {
          path: 'userId',
          select: 'name profileImage',
        }
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: courses.length,
      courses,
    });
  } catch (error) {
    console.error('Get my courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};


// @desc    Get course students with details (Tutor only)
// @route   GET /api/courses/:id/students
export const getCourseStudentsDetailed = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if course exists and user owns it
    const course = await Course.findById(id).populate('tutorId');

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    if (course.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view students',
      });
    }

    // Get all enrollments with student details
    const enrollments = await Enrollment.find({ courseId: id })
      .populate('studentId', 'name email phone profileImage')
      .sort({ enrolledAt: -1 });

    // Get lesson count for progress calculation
    const totalLessons = await Lesson.countDocuments({ courseId: id });

    // Format student data with progress
    const students = enrollments.map(enrollment => ({
      enrollmentId: enrollment._id,
      student: enrollment.studentId,
      enrolledAt: enrollment.enrolledAt,
      lastAccessed: enrollment.lastAccessed,
      status: enrollment.status,
      progress: {
        percentage: enrollment.progress.percentage,
        completedLessons: enrollment.progress.completedLessons.length,
        totalLessons,
      },
      completedAt: enrollment.completedAt,
    }));

    res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    console.error('Get course students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};