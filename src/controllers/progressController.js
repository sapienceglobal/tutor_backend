import Progress from '../models/Progress.js';
import Enrollment from '../models/Enrollment.js';
import Lesson from '../models/Lesson.js';
import { createNotification } from './notificationController.js';

// @desc    Update lesson progress
// @route   POST /api/progress
export const updateProgress = async (req, res) => {
  try {
    const { courseId, lessonId, completed, timeSpent, lastWatchedPosition } = req.body;

    if (!courseId || !lessonId) {
      return res.status(400).json({ success: false, message: 'Course ID and Lesson ID required' });
    }

    // 1. Check Enrollment
    const enrollment = await Enrollment.findOne({
      studentId: req.user.id,
      courseId,
    });

    if (!enrollment) {
      return res.status(403).json({ success: false, message: 'Not enrolled' });
    }

    // 2. Find or Create Progress
    let progress = await Progress.findOne({
      studentId: req.user.id,
      courseId,
      lessonId,
    });

    // Determine requested completion status (handle boolean or string)
    const isCompletedRequest = completed === true || completed === 'true';

    // DEBUG LOG: Request Details
    // console.log('--- PROGRESS UPDATE REQUEST ---');
    // console.log(`Lesson ID: ${lessonId}`);
    // console.log(`Incoming 'completed': ${completed} (Parsed: ${isCompletedRequest})`);
    // console.log(`Incoming 'timeSpent': ${timeSpent}`);

    if (progress) {
      // Update existing
      // console.log(`>>> Current DB Status: completed=${progress.completed}`);

      // ✅ LOGIC: Only mark true if requested. Never revert to false.
      if (isCompletedRequest) {
        if (!progress.completed) {
          // console.log('>>> ACTION: Marking lesson as COMPLETED (First Time)');
          progress.completed = true;
          progress.completedAt = new Date();

          // Notification Logic
          try {
            const lesson = await Lesson.findById(lessonId);
            if (lesson) {
              await createNotification({
                userId: req.user.id,
                type: 'lesson_completed',
                title: '✅ Lesson Completed!',
                message: `You completed "${lesson.title}"`,
                data: { courseId, lessonId }
              });
            }
          } catch (err) { console.log("Notification error", err); }
        } else {
          console.log('>>> ACTION: Lesson already completed, updating timestamp only.');
        }
      } else {
        console.log('>>> ACTION: Syncing time only (Not completing).');
      }

      if (timeSpent !== undefined) progress.timeSpent = timeSpent;
      if (lastWatchedPosition !== undefined) progress.lastWatchedPosition = lastWatchedPosition;

      await progress.save();
    } else {
      // Create new
      // console.log('>>> ACTION: Creating New Progress Entry');
      progress = await Progress.create({
        studentId: req.user.id,
        courseId,
        lessonId,
        completed: isCompletedRequest || false,
        timeSpent: timeSpent || 0,
        lastWatchedPosition: lastWatchedPosition || 0,
        completedAt: isCompletedRequest ? new Date() : null,
      });
    }

    // 3. Recalculate Course Percentage
    await updateEnrollmentProgress(req.user.id, courseId);

    res.status(200).json({
      success: true,
      message: 'Progress updated',
      progress,
    });

  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get course progress
// @route   GET /api/progress/course/:courseId
export const getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const progress = await Progress.find({
      studentId: req.user.id,
      courseId,
    });

    const enrollment = await Enrollment.findOne({
      studentId: req.user.id,
      courseId
    });

    res.status(200).json({ success: true, progress, enrollment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get lesson progress
// @route   GET /api/progress/lesson/:lessonId
export const getLessonProgress = async (req, res) => {
  try {
    const progress = await Progress.findOne({
      studentId: req.user.id,
      lessonId: req.params.lessonId,
    });
    res.status(200).json({ success: true, progress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- HELPER FUNCTION ---
async function updateEnrollmentProgress(studentId, courseId) {
  // console.log('=== ENROLLMENT UPDATE START ===');
  // console.log('Student ID:', studentId);
  // console.log('Course ID:', courseId);
  try {
    const enrollment = await Enrollment.findOne({ studentId, courseId });
    // console.log('Enrollment found:', !!enrollment);
    // console.log('Current percentage BEFORE update:', enrollment?.progress.percentage);
    if (!enrollment) return;

    // 1. Get Total Lessons
    const totalLessons = await Lesson.countDocuments({ courseId });

    // 2. Get Completed Lessons Count
    const completedProgress = await Progress.find({
      studentId,
      courseId,
      completed: true,
    });

    const uniqueCompletedLessonIds = [...new Set(completedProgress.map(p => p.lessonId.toString()))];

   
    // 3. Calculate Percentage
    let percentage = 0;
    if (totalLessons > 0) {
      percentage = Math.round((uniqueCompletedLessonIds.length / totalLessons) * 100);
    }

    if (percentage > 100) percentage = 100;

    // 4. Update Enrollment
    enrollment.progress.completedLessons = uniqueCompletedLessonIds;
    enrollment.progress.percentage = percentage;
    enrollment.lastAccessed = new Date();

    if (percentage === 100 && enrollment.status !== 'completed') {
      enrollment.status = 'completed';
      enrollment.completedAt = new Date();
    }

    await enrollment.save();
    // console.log('New percentage AFTER save:', enrollment.progress.percentage);
    // console.log('=== ENROLLMENT UPDATE END ===');

  } catch (error) {
    console.error('Update enrollment progress helper error:', error);
  }
}