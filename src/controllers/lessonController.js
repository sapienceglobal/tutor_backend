import Lesson from '../models/Lesson.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Progress from '../models/Progress.js';

// @desc    Get all lessons for a course
// @route   GET /api/lessons/course/:courseId
export const getLessonsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    // Check if user is enrolled or owns the course
    let canAccess = false;
    if (req.user) {
      const enrollment = await Enrollment.findOne({
        studentId: req.user.id,
        courseId,
      });
      
      const tutor = await Course.findById(courseId).populate('tutorId');
      const isOwner = tutor.tutorId.userId.toString() === req.user.id;

      canAccess = !!enrollment || isOwner || course.isFree;
    }

    let lessons = await Lesson.find({ courseId, isPublished: true })
      .sort({ order: 1 });

    // If not enrolled and course is paid, only show free lessons
    if (!canAccess && !course.isFree) {
      lessons = lessons.map(lesson => ({
        ...lesson.toObject(),
        content: lesson.isFree ? lesson.content : null,
      }));
    }

    // Get progress for enrolled students
    let progress = [];
    if (req.user && canAccess) {
      progress = await Progress.find({
        studentId: req.user.id,
        courseId,
      });
    }

    res.status(200).json({
      success: true,
      count: lessons.length,
      lessons,
      progress,
      canAccess,
    });
  } catch (error) {
    console.error('Get lessons error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get single lesson
// @route   GET /api/lessons/:id
export const getLessonById = async (req, res) => {
  try {
    const { id } = req.params;

    const lesson = await Lesson.findById(id).populate('courseId');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found',
      });
    }

    // Check access rights
    let canAccess = lesson.isFree;
    
    if (req.user && !canAccess) {
      const enrollment = await Enrollment.findOne({
        studentId: req.user.id,
        courseId: lesson.courseId._id,
      });

      const course = await Course.findById(lesson.courseId).populate('tutorId');
      const isOwner = course.tutorId.userId.toString() === req.user.id;

      canAccess = !!enrollment || isOwner;
    }

    if (!canAccess) {
      return res.status(403).json({
        success: false,
        message: 'Enroll in the course to access this lesson',
      });
    }

    // Get user's progress for this lesson
    let userProgress = null;
    if (req.user) {
      userProgress = await Progress.findOne({
        studentId: req.user.id,
        lessonId: id,
      });
    }

    res.status(200).json({
      success: true,
      lesson,
      progress: userProgress,
    });
  } catch (error) {
    console.error('Get lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Create lesson (Tutor only)
// @route   POST /api/lessons
export const createLesson = async (req, res) => {
  try {
    const {
      courseId,
      moduleId,
      title,
      description,
      type,
      content,
      order,
      isFree,
    } = req.body;

    if (!courseId || !moduleId || !title) {
      return res.status(400).json({
        success: false,
        message: 'Course ID, Module ID, and title are required',
      });
    }

    // Check if course exists and user owns it
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
        message: 'Not authorized to add lessons to this course',
      });
    }

    const lesson = await Lesson.create({
      courseId,
      moduleId,
      title,
      description,
      type: type || 'video',
      content: content || {},
      order: order || 0,
      isFree: isFree || false,
    });

    res.status(201).json({
      success: true,
      message: 'Lesson created successfully',
      lesson,
    });
  } catch (error) {
    console.error('Create lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Update lesson (Tutor only)
// @route   PATCH /api/lessons/:id
export const updateLesson = async (req, res) => {
  try {
    const { id } = req.params;

    const lesson = await Lesson.findById(id).populate({
      path: 'courseId',
      populate: {
        path: 'tutorId',
      },
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found',
      });
    }

    // Check if user owns the course
    if (lesson.courseId.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this lesson',
      });
    }

    const allowedUpdates = [
      'title', 'description', 'type', 'content',
      'order', 'isFree', 'isPublished',
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        lesson[field] = req.body[field];
      }
    });

    await lesson.save();

    res.status(200).json({
      success: true,
      message: 'Lesson updated successfully',
      lesson,
    });
  } catch (error) {
    console.error('Update lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Delete lesson (Tutor only)
// @route   DELETE /api/lessons/:id
export const deleteLesson = async (req, res) => {
  try {
    const { id } = req.params;

    const lesson = await Lesson.findById(id).populate({
      path: 'courseId',
      populate: {
        path: 'tutorId',
      },
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found',
      });
    }

    // Check if user owns the course
    if (lesson.courseId.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this lesson',
      });
    }

    // Delete all progress records for this lesson
    await Progress.deleteMany({ lessonId: id });

    await lesson.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Lesson deleted successfully',
    });
  } catch (error) {
    console.error('Delete lesson error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};