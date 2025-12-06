import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Progress from '../models/Progress.js';

// @desc    Enroll in a course
// @route   POST /api/enrollments
export const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
    }

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    if (course.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Course is not available for enrollment',
      });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      studentId: req.user.id,
      courseId,
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: 'Already enrolled in this course',
      });
    }

    // For paid courses, check payment (implement payment logic here)
    if (!course.isFree) {
      // TODO: Implement payment verification
      // For now, we'll allow enrollment
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      studentId: req.user.id,
      courseId,
    });

    // Update course enrolled count
    course.enrolledCount += 1;
    await course.save();

    const populatedEnrollment = await Enrollment.findById(enrollment._id)
      .populate('courseId')
      .populate('studentId', 'name email profileImage');

    res.status(201).json({
      success: true,
      message: 'Enrolled successfully',
      enrollment: populatedEnrollment,
    });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get my enrollments
// @route   GET /api/enrollments/my-enrollments
export const getMyEnrollments = async (req, res) => {
  try {
    const { status } = req.query;

    let filter = { studentId: req.user.id };
    if (status) filter.status = status;

    const enrollments = await Enrollment.find(filter)
      .populate({
        path: 'courseId',
        populate: {
          path: 'tutorId',
          populate: {
            path: 'userId',
            select: 'name profileImage',
          },
        },
      })
      .sort({ enrolledAt: -1 });

    res.status(200).json({
      success: true,
      count: enrollments.length,
      enrollments,
    });
  } catch (error) {
    console.error('Get enrollments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get enrollment by course
// @route   GET /api/enrollments/course/:courseId
export const getEnrollmentByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({
      studentId: req.user.id,
      courseId,
    })
      .populate('courseId')
      .populate('studentId', 'name email profileImage');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Not enrolled in this course',
      });
    }

    res.status(200).json({
      success: true,
      enrollment,
    });
  } catch (error) {
    console.error('Get enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get students enrolled in a course (Tutor only)
// @route   GET /api/enrollments/students/:courseId
export const getCourseStudents = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if user owns the course
    const course = await Course.findById(courseId).populate('tutorId');
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

    const enrollments = await Enrollment.find({ courseId })
      .populate('studentId', 'name email phone profileImage')
      .sort({ enrolledAt: -1 });

    res.status(200).json({
      success: true,
      count: enrollments.length,
      students: enrollments,
    });
  } catch (error) {
    console.error('Get course students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Unenroll from course
// @route   DELETE /api/enrollments/:id
export const unenrollFromCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const enrollment = await Enrollment.findById(id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found',
      });
    }

    // Check if user owns this enrollment
    if (enrollment.studentId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to unenroll',
      });
    }

    // Update course enrolled count
    const course = await Course.findById(enrollment.courseId);
    if (course) {
      course.enrolledCount = Math.max(0, course.enrolledCount - 1);
      await course.save();
    }

    // Delete all progress
    await Progress.deleteMany({
      studentId: req.user.id,
      courseId: enrollment.courseId,
    });

    await enrollment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Unenrolled successfully',
    });
  } catch (error) {
    console.error('Unenroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Update lesson progress
// @route   PATCH /api/enrollments/:id/progress
export const updateProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { lessonId, watchedDuration, isCompleted } = req.body;

    if (!lessonId) {
      return res.status(400).json({
        success: false,
        message: 'Lesson ID is required',
      });
    }

    const enrollment = await Enrollment.findById(id);

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found',
      });
    }

    // Check if user owns this enrollment
    if (enrollment.studentId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Find or create progress
    let progress = await Progress.findOne({
      enrollmentId: id,
      lessonId,
    });

    if (progress) {
      progress.watchedDuration = watchedDuration || progress.watchedDuration;
      progress.isCompleted = isCompleted !== undefined ? isCompleted : progress.isCompleted;
      progress.lastWatched = Date.now();
      await progress.save();
    } else {
      progress = await Progress.create({
        enrollmentId: id,
        lessonId,
        watchedDuration: watchedDuration || 0,
        isCompleted: isCompleted || false,
      });
    }

    // Update enrollment progress
    const totalLessons = await Lesson.countDocuments({ courseId: enrollment.courseId });
    const completedLessons = await Progress.countDocuments({
      enrollmentId: id,
      isCompleted: true,
    });

    enrollment.progress.completedLessons = await Progress.find({
      enrollmentId: id,
      isCompleted: true,
    }).distinct('lessonId');

    enrollment.progress.percentage = totalLessons > 0
      ? (completedLessons / totalLessons) * 100
      : 0;

    enrollment.lastAccessed = Date.now();

    // Check if course completed
    if (enrollment.progress.percentage === 100) {
      enrollment.status = 'completed';
      enrollment.completedAt = Date.now();
    }

    await enrollment.save();

    res.status(200).json({
      success: true,
      message: 'Progress updated successfully',
      progress,
      enrollment,
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Check if enrolled in course
// @route   GET /api/enrollments/check/:courseId
export const checkEnrollment = async (req, res) => {
  try {
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({
      studentId: req.user.id,
      courseId,
    });

    res.status(200).json({
      success: true,
      isEnrolled: !!enrollment,
      enrollment: enrollment || null,
    });
  } catch (error) {
    console.error('Check enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};