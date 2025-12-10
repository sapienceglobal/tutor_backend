import Progress from '../models/Progress.js';
import Enrollment from '../models/Enrollment.js';
import Lesson from '../models/Lesson.js';
import Course from '../models/Course.js';

// @desc    Update lesson progress
// @route   POST /api/progress
export const updateProgress = async (req, res) => {
  try {
    const { courseId, lessonId, completed, timeSpent, lastWatchedPosition } = req.body;

    if (!courseId || !lessonId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID and Lesson ID are required',
      });
    }

    // Check if user is enrolled
    const enrollment = await Enrollment.findOne({
      studentId: req.user.id,
      courseId,
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'Not enrolled in this course',
      });
    }

    // Update or create progress
    let progress = await Progress.findOne({
      studentId: req.user.id,
      courseId,
      lessonId,
    });

    if (progress) {
      if (completed !== undefined) progress.completed = completed;
      if (timeSpent !== undefined) progress.timeSpent = timeSpent;
      if (lastWatchedPosition !== undefined) {
        progress.lastWatchedPosition = lastWatchedPosition;
      }

      if (completed && !progress.completedAt) {
        progress.completedAt = new Date();
      }

      await progress.save();
    } else {
      progress = await Progress.create({
        studentId: req.user.id,
        courseId,
        lessonId,
        completed: completed || false,
        timeSpent: timeSpent || 0,
        lastWatchedPosition: lastWatchedPosition || 0,
        completedAt: completed ? new Date() : null,
      });
    }

    // Update enrollment progress
    await updateEnrollmentProgress(req.user.id, courseId);

    res.status(200).json({
      success: true,
      message: 'Progress updated successfully',
      progress,
    });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Get course progress
// @route   GET /api/progress/course/:courseId
export const getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;

    // Check if enrolled
    const enrollment = await Enrollment.findOne({
      studentId: req.user.id,
      courseId,
    });

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'Not enrolled in this course',
      });
    }

    const progress = await Progress.find({
      studentId: req.user.id,
      courseId,
    }).populate('lessonId');

    res.status(200).json({
      success: true,
      progress,
      enrollment,
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Helper function to update enrollment progress percentage
async function updateEnrollmentProgress(studentId, courseId) {
  try {
    const enrollment = await Enrollment.findOne({ studentId, courseId });
    if (!enrollment) return;

    // Get total lessons
    const totalLessons = await Lesson.countDocuments({
      courseId,
      isPublished: true,
    });

    if (totalLessons === 0) {
      enrollment.progress.percentage = 0;
      await enrollment.save();
      return;
    }

    // Get completed lessons
    const completedProgress = await Progress.find({
      studentId,
      courseId,
      completed: true,
    });

    const completedLessonIds = completedProgress.map(p => p.lessonId);
    enrollment.progress.completedLessons = completedLessonIds;
    enrollment.progress.percentage = Math.round(
      (completedLessonIds.length / totalLessons) * 100
    );

    // Check if course is completed
    if (enrollment.progress.percentage === 100 && enrollment.status !== 'completed') {
      enrollment.status = 'completed';
      enrollment.completedAt = new Date();
    }

    enrollment.lastAccessed = new Date();
    await enrollment.save();
  } catch (error) {
    console.error('Update enrollment progress error:', error);
  }
}

// @desc    Get lesson progress
// @route   GET /api/progress/lesson/:lessonId
export const getLessonProgress = async (req, res) => {
  try {
    const { lessonId } = req.params;

    const progress = await Progress.findOne({
      studentId: req.user.id,
      lessonId,
    });

    res.status(200).json({
      success: true,
      progress: progress || null,
    });
  } catch (error) {
    console.error('Get lesson progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};