import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Progress from '../models/Progress.js';
import { createNotification } from './notificationController.js';

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

    // Check if course exists and its availability
    const course = await Course.findById(courseId).populate({
        path: 'tutorId',
        populate: { path: 'userId' },
    });
    
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const isTutorVerified = course.tutorId && course.tutorId.isVerified;
    const isTutorBlocked = course.tutorId && course.tutorId.userId && course.tutorId.userId.isBlocked;
    const isCourseAvailable = course.status === 'published' && isTutorVerified && !isTutorBlocked;

    if (!isCourseAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Course is not currently available for new enrollments',
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

    await createNotification({
      userId: req.user.id,
      type: 'course_enrolled',
      title: '🎉 Course Enrolled!',
      message: `You have successfully enrolled in "${course.title}"`,
      data: {
        courseId: course._id
      }
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

    // ✅ FIX: Populate BOTH studentId AND courseId with nested tutorId
    const enrollments = await Enrollment.find({ courseId })
      .populate({
        path: 'studentId',
        select: 'name email phone profileImage',
        model: 'User'
      })
      .populate({
        path: 'courseId',
        model: 'Course',
        populate: {
          path: 'tutorId',
          model: 'Tutor',
          populate: {
            path: 'userId',
            model: 'User',
            select: 'name email profileImage'
          }
        }
      })
      .sort({ enrolledAt: -1 })
      .lean();

    // ✅ Filter out enrollments where data wasn't properly populated
    const validEnrollments = enrollments.filter(e => {
      const hasValidStudent = typeof e.studentId === 'object' &&
        e.studentId !== null &&
        e.studentId.name;

      const hasValidCourse = typeof e.courseId === 'object' &&
        e.courseId !== null &&
        e.courseId.title;

      const isValid = hasValidStudent && hasValidCourse;

      return isValid;
    });



    res.status(200).json({
      success: true,
      count: validEnrollments.length,
      students: validEnrollments,
    });
  } catch (error) {
    console.error('❌ Get course students error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
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

// @desc    Remove student from course (Tutor only)
// @route   DELETE /api/enrollments/tutor/:id
export const removeStudentFromCourse = async (req, res) => {
  try {
    const { id } = req.params;

    const enrollment = await Enrollment.findById(id).populate('courseId');

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found',
      });
    }

    // Verify Tutor Ownership
    // enrollment.courseId is the populated Course object.
    
    const course = await Course.findById(enrollment.courseId._id).populate({
        path: 'tutorId',
        select: 'userId'
    });

    if (!course) {
        return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check ownership
    // tutorId is populated, so we check tutorId.userId._id (or string) vs req.user.id
    // But wait, the population above selects userId from Tutor.
    // So course.tutorId is the Tutor document. course.tutorId.userId is the User ID (or object).
    
    // Let's rely on string comparison
    if (course.tutorId?.userId?.toString() !== req.user.id) {
        return res.status(403).json({
            success: false,
            message: 'Not authorized to remove student from this course'
        });
    }

    // Update course count
    course.enrolledCount = Math.max(0, course.enrolledCount - 1);
    await course.save();

    // Delete progress
    await Progress.deleteMany({
      studentId: enrollment.studentId,
      courseId: enrollment.courseId._id,
    });

    // Delete enrollment
    await enrollment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Student removed from course successfully',
    });

  } catch (error) {
    console.error('Remove student error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
