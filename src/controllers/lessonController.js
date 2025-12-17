import Lesson from '../models/Lesson.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Progress from '../models/Progress.js';
import { createNotification } from './notificationController.js';

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

// ✅ Helper function to clean quiz data
function cleanQuizData(content) {
  if (!content || !content.quiz || !content.quiz.questions) {
    return content;
  }

  const cleanedContent = { ...content };

  cleanedContent.quiz.questions = content.quiz.questions.map(q => {
    // Remove _id from question
    const { _id, ...cleanQuestion } = q;

    // Remove _id from options
    if (cleanQuestion.options && Array.isArray(cleanQuestion.options)) {
      cleanQuestion.options = cleanQuestion.options.map(opt => {
        const { _id, ...cleanOpt } = opt;
        return cleanOpt;
      });
    }

    return cleanQuestion;
  });

  return cleanedContent;
}

export const createLesson = async (req, res) => {
  try {
    let {
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

    // ✅ Clean quiz data if present
    if (type === 'quiz' && content) {
      content = cleanQuizData(content);
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

    // ✅ Notify enrolled students (not tutor)
    const enrollments = await Enrollment.find({
      courseId: lesson.courseId,
      status: 'active'
    });

    for (const enrollment of enrollments) {
      await createNotification({
        userId: enrollment.studentId,
        type: 'new_lesson',
        title: '📚 New Lesson Available!',
        message: `New lesson "${lesson.title}" added to your enrolled course`,
        data: {
          courseId: lesson.courseId,
          lessonId: lesson._id
        }
      });
    }

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
      error: error.message, // ✅ Better error debugging
    });
  }
};

export const updateLesson = async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = req.body;

    const lesson = await Lesson.findById(id).populate({
      path: 'courseId',
      populate: { path: 'tutorId' },
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found',
      });
    }

    // Check authorization
    if (lesson.courseId.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this lesson',
      });
    }

    // ✅ Clean quiz data if present
    if (updateData.type === 'quiz' && updateData.content) {
      updateData.content = cleanQuizData(updateData.content);
    }

    // Update lesson
    Object.assign(lesson, updateData);
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
      error: error.message,
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


// File

// ============================================================================
// UPLOAD DOCUMENT TO LESSON
// ============================================================================
export const uploadDocumentToLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { name, url, type, size, publicId } = req.body;

    // Validate required fields
    if (!name || !url || !type) {
      return res.status(400).json({
        success: false,
        message: 'Name, URL, and type are required',
      });
    }

    // Find lesson
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found',
      });
    }

    // Check if user is the course owner/tutor
    const course = await Course.findById(lesson.courseId).populate('tutorId');
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found',
      });
    }

    const isOwner = course.tutorId.userId.toString() === req.user.id;
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only course owner can upload documents',
      });
    }

    // Initialize documents array if lesson type is 'document'
    if (lesson.type === 'document') {
      if (!lesson.content.documents) {
        lesson.content.documents = [];
      }

      // Add document to array
      lesson.content.documents.push({
        name,
        url,
        type,
        size,
        publicId, // Store for deletion
      });
    } else {
      // For other lesson types, add to attachments
      if (!lesson.content.attachments) {
        lesson.content.attachments = [];
      }

      lesson.content.attachments.push({
        name,
        url,
        type,
        size,
        publicId,
      });
    }

    // Save lesson
    await lesson.save();

    res.status(200).json({
      success: true,
      message: 'Document added to lesson successfully',
      lesson,
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add document to lesson',
    });
  }
};

// ============================================================================
// DELETE DOCUMENT FROM LESSON
// ============================================================================
export const deleteDocumentFromLesson = async (req, res) => {
  try {
    const { lessonId, documentId } = req.params;

    // Find lesson
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found',
      });
    }

    // Check ownership
    const course = await Course.findById(lesson.courseId).populate('tutorId');
    const isOwner = course.tutorId.userId.toString() === req.user.id;
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only course owner can delete documents',
      });
    }

    let documentFound = false;
    let publicIdToDelete = null;

    // Remove from documents array
    if (lesson.content.documents) {
      const docToDelete = lesson.content.documents.find(
        doc => doc._id.toString() === documentId
      );
      if (docToDelete) {
        publicIdToDelete = docToDelete.publicId;
        lesson.content.documents = lesson.content.documents.filter(
          doc => doc._id.toString() !== documentId
        );
        documentFound = true;
      }
    }

    // Remove from attachments array if not found in documents
    if (!documentFound && lesson.content.attachments) {
      const attToDelete = lesson.content.attachments.find(
        att => att._id.toString() === documentId
      );
      if (attToDelete) {
        publicIdToDelete = attToDelete.publicId;
        lesson.content.attachments = lesson.content.attachments.filter(
          att => att._id.toString() !== documentId
        );
        documentFound = true;
      }
    }

    if (!documentFound) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    await lesson.save();

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
      publicId: publicIdToDelete, // Return publicId so Flutter can delete from Cloudinary
      lesson,
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document',
    });
  }
};

// ============================================================================
// GET ALL DOCUMENTS OF A LESSON
// ============================================================================
export const getLessonDocuments = async (req, res) => {
  try {
    const { lessonId } = req.params;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found',
      });
    }

    // Combine documents and attachments
    const allDocuments = [
      ...(lesson.content.documents || []),
      ...(lesson.content.attachments || []),
    ];

    res.status(200).json({
      success: true,
      documents: allDocuments,
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get documents',
    });
  }
};