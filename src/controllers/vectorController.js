import VectorService from '../services/vectorService-mock.js';
import Lesson from '../models/Lesson.js';
import Course from '../models/Course.js';
import AIUsageLog from '../models/AIUsageLog.js';
import Institute from '../models/Institute.js';

// @desc    Generate embeddings for a lesson
// @route   POST /api/vector/generate/:lessonId
export const generateLessonEmbeddings = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    // Verify lesson exists and user has access
    const lesson = await Lesson.findById(lessonId).populate({
      path: 'courseId',
      populate: {
        path: 'instituteId'
      }
    });

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Check authorization (tutor who created the course or admin)
    if (lesson.courseId.tutorId.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to generate embeddings for this lesson'
      });
    }

    // Generate embeddings
    const result = await VectorService.processLessonContent(lessonId);

    // Log AI usage
    await logAIUsage(userId, 'generate_embeddings', {
      lessonId,
      embeddingsCount: result.embeddingsCount,
      lessonTitle: result.lessonTitle
    });

    res.status(200).json({
      success: true,
      message: `Successfully generated ${result.embeddingsCount} embeddings for lesson: ${result.lessonTitle}`,
      data: result
    });

  } catch (error) {
    console.error('Generate embeddings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate embeddings',
      error: error.message
    });
  }
};

// @desc    Generate embeddings for all lessons in a course
// @route   POST /api/vector/generate-course/:courseId
export const generateCourseEmbeddings = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Verify course exists and user has access
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Check authorization
    if (course.tutorId.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to generate embeddings for this course'
      });
    }

    // Get all lessons in the course
    const lessons = await Lesson.find({ courseId });
    
    if (lessons.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No lessons found in this course',
        data: { totalEmbeddings: 0, lessonsProcessed: 0 }
      });
    }

    let totalEmbeddings = 0;
    const results = [];

    // Process each lesson
    for (const lesson of lessons) {
      try {
        const result = await VectorService.processLessonContent(lesson._id);
        totalEmbeddings += result.embeddingsCount;
        results.push({
          lessonId: lesson._id,
          lessonTitle: lesson.title,
          embeddingsCount: result.embeddingsCount,
          success: true
        });
      } catch (error) {
        results.push({
          lessonId: lesson._id,
          lessonTitle: lesson.title,
          embeddingsCount: 0,
          success: false,
          error: error.message
        });
      }
    }

    // Log AI usage
    await logAIUsage(userId, 'generate_course_embeddings', {
      courseId,
      totalEmbeddings,
      lessonsProcessed: lessons.length
    });

    res.status(200).json({
      success: true,
      message: `Successfully processed ${lessons.length} lessons with ${totalEmbeddings} total embeddings`,
      data: {
        totalEmbeddings,
        lessonsProcessed: lessons.length,
        results
      }
    });

  } catch (error) {
    console.error('Generate course embeddings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate course embeddings',
      error: error.message
    });
  }
};

// @desc    Perform similarity search for RAG
// @route   POST /api/vector/search
export const similaritySearch = async (req, res) => {
  try {
    const { query, courseId, limit = 5 } = req.body;
    const userId = req.user.id;

    if (!query || !courseId) {
      return res.status(400).json({
        success: false,
        message: 'Query and courseId are required'
      });
    }

    // Verify course exists and user has access
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Get user's instituteId
    const user = await (await import('../models/User.js')).default.findById(userId);
    const instituteId = user?.instituteId || course.instituteId;

    // Perform similarity search
    const results = await VectorService.similaritySearch(query, courseId, instituteId, limit);

    // Log AI usage
    await logAIUsage(userId, 'similarity_search', {
      query,
      courseId,
      resultsCount: results.length
    });

    res.status(200).json({
      success: true,
      message: `Found ${results.length} relevant documents`,
      data: {
        query,
        results,
        count: results.length
      }
    });

  } catch (error) {
    console.error('Similarity search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform similarity search',
      error: error.message
    });
  }
};

// @desc    Get embedding statistics
// @route   GET /api/vector/stats
export const getEmbeddingStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's instituteId
    const user = await (await import('../models/User.js')).default.findById(userId);
    const instituteId = user?.instituteId;

    if (!instituteId) {
      return res.status(400).json({
        success: false,
        message: 'User is not associated with any institute'
      });
    }

    // Get statistics
    const stats = await VectorService.getEmbeddingStats(instituteId);

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get embedding stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get embedding statistics',
      error: error.message
    });
  }
};

// @desc    Delete embeddings for a lesson
// @route   DELETE /api/vector/lesson/:lessonId
export const deleteLessonEmbeddings = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    // Verify lesson exists and user has access
    const lesson = await Lesson.findById(lessonId).populate('courseId');

    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: 'Lesson not found'
      });
    }

    // Check authorization
    if (lesson.courseId.tutorId.toString() !== userId && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete embeddings for this lesson'
      });
    }

    // Delete embeddings
    await VectorService.deleteLessonEmbeddings(lessonId);

    res.status(200).json({
      success: true,
      message: 'Successfully deleted embeddings for the lesson'
    });

  } catch (error) {
    console.error('Delete embeddings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete embeddings',
      error: error.message
    });
  }
};

// AI Usage logging helper
async function logAIUsage(userId, action, details = {}) {
  try {
    const user = await (await import('../models/User.js')).default.findById(userId);
    const instituteId = user?.instituteId || null;

    await AIUsageLog.create({ userId, instituteId, action, details });

    // Increment institute AI usage count
    if (instituteId) {
      await Institute.findByIdAndUpdate(instituteId, { $inc: { aiUsageCount: 1 } });
    }
  } catch (err) {
    console.error('AI usage log error:', err.message);
  }
}
