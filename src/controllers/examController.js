import { Exam, ExamAttempt } from '../models/Exam.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import mongoose from 'mongoose';

// @desc    Get all exams for a course (Tutor)
// @route   GET /api/exams/course/:courseId
export const getExamsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id; // Assuming user is authenticated

    // Aggregation Pipeline to merge Exam data with Student's Attempts
    const exams = await Exam.aggregate([
      {
        $match: {
          courseId: new mongoose.Types.ObjectId(courseId),
          status: 'published' // Only show published exams to students
        }
      },
      // Lookup attempts for this specific student
      {
        $lookup: {
          from: 'examattempts', // Collection name (check your DB, usually lowercase plural)
          let: { examId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$examId', '$$examId'] },
                    { $eq: ['$studentId', new mongoose.Types.ObjectId(studentId)] }
                  ]
                }
              }
            },
            { $project: { score: 1, isPassed: 1, submittedAt: 1 } } // Only need these fields
          ],
          as: 'myAttempts'
        }
      },
      // Add fields for frontend logic
      {
        $addFields: {
          attemptCount: { $size: '$myAttempts' },
          lastAttempt: { $last: '$myAttempts' },
          isCompleted: {
            $cond: {
              if: { $gt: [{ $size: '$myAttempts' }, 0] },
              then: true,
              else: false
            }
          }
        }
      },
      {
        $project: {
          myAttempts: 0 // Remove the full array to keep response light
        }
      }
    ]);

    res.status(200).json({
      success: true,
      exams: exams,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single exam
// @route   GET /api/exams/:id
export const getExamById = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id).populate('courseId');

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    // Check access rights
    const course = await Course.findById(exam.courseId).populate('tutorId');
    const isOwner = course.tutorId.userId.toString() === req.user.id;

    // 1. Schedule Check (for students)
    if (!isOwner && exam.isScheduled) {
      const now = new Date();
      const start = new Date(exam.startDate);
      const end = new Date(exam.endDate);

      if (now < start) {
        return res.status(403).json({
          success: false,
          message: `Exam has not started yet. Starts at: ${start.toLocaleString()}`
        });
      }
      if (now > end) {
        return res.status(403).json({
          success: false,
          message: `Exam has ended on: ${end.toLocaleString()}`
        });
      }
    }

    let enrollment = null;
    // 2. Enrollment Check (skip if isFree or isOwner)
    if (!isOwner && !exam.isFree) {
      enrollment = await Enrollment.findOne({
        studentId: req.user.id,
        courseId: exam.courseId._id,
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'Enroll in the course to access this exam',
        });
      }
    }

    // Get student's attempts if not owner
    let attempts = [];
    if (!isOwner) {
      attempts = await ExamAttempt.find({
        examId: id,
        studentId: req.user.id,
      }).sort({ createdAt: -1 });
    }

    // Prepare Exam Data
    let examData = exam.toObject();

    // 3. Shuffling Logic (for students)
    if (!isOwner) {
      // Shuffle Questions
      if (exam.shuffleQuestions) {
        for (let i = examData.questions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [examData.questions[i], examData.questions[j]] = [examData.questions[j], examData.questions[i]];
        }
      }

      // Shuffle Options
      if (exam.shuffleOptions) {
        examData.questions.forEach(q => {
          for (let i = q.options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
          }
        });
      }
    }

    // Hide correct answers for students until after submission (unless it's a practice set)
    if (!isOwner && !exam.showCorrectAnswers && exam.type !== 'practice') {
      examData.questions = examData.questions.map(q => ({
        ...q,
        options: q.options.map(opt => ({
          text: opt.text,
          _id: opt._id,
        })),
      }));
    }

    res.status(200).json({
      success: true,
      exam: examData,
      attempts,
      remainingAttempts: exam.maxAttempts - attempts.length,
    });
  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Create exam (Tutor only)
// @route   POST /api/exams
export const createExam = async (req, res) => {
  try {
    const {
      courseId,
      title,
      description,
      type,
      instructions,
      duration,
      passingMarks,
      questions,
      shuffleQuestions,
      shuffleOptions,
      showResultImmediately,
      showCorrectAnswers,
      allowRetake,
      maxAttempts,
      startDate,
      endDate,

      status, // Extract status
      negativeMarking,
      passingPercentage,
      isFree,
      hideSolutions
    } = req.body;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required',
      });
    }
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Exam title is required',
      });
    }
    if (!duration) {
      return res.status(400).json({
        success: false,
        message: 'Duration is required',
      });
    }

    // Only require questions if publishing or not specified (default published)
    const isDraft = status === 'draft';
    if (!isDraft && (!questions || questions.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Questions are required to publish an exam',
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
        message: 'Not authorized to create exam for this course',
      });
    }

    // Strip _id from questions to let Mongoose generate them
    const questionsToProcess = questions || [];
    const cleanedQuestions = questionsToProcess.map(q => {
      const { _id, ...questionWithoutId } = q;
      return questionWithoutId;
    });

    const examStatus = status || 'published';

    const exam = await Exam.create({
      courseId,
      tutorId: course.tutorId._id,
      title,
      description,
      type: type || 'assessment',
      instructions,
      duration,
      passingMarks,
      questions: cleanedQuestions,
      shuffleQuestions: shuffleQuestions || false,
      shuffleOptions: shuffleOptions || false,
      showResultImmediately: showResultImmediately || false,
      showCorrectAnswers: showCorrectAnswers || true,
      hideSolutions: hideSolutions || false,
      allowRetake: allowRetake || false,
      maxAttempts: maxAttempts || 1,
      startDate,
      endDate,
      isScheduled: !!(startDate && endDate),
      status: examStatus,
      isPublished: examStatus === 'published',
      negativeMarking: negativeMarking || false,
      passingPercentage: passingPercentage || 0,
      isFree: isFree || false,
    });

    res.status(201).json({
      success: true,
      message: 'Exam created successfully',
      exam,
    });
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Update exam (Tutor only)
// @route   PATCH /api/exams/:id
export const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findById(id).populate({
      path: 'courseId',
      populate: {
        path: 'tutorId',
      },
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    // Check if user owns the course
    if (exam.courseId.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this exam',
      });
    }

    const allowedUpdates = [
      'title', 'description', 'type', 'instructions', 'duration',
      'passingMarks', 'questions', 'shuffleQuestions', 'shuffleOptions',
      'showResultImmediately', 'showCorrectAnswers', 'hideSolutions', 'allowRetake',
      'maxAttempts', 'startDate', 'endDate', 'isScheduled', 'status', 'isPublished',
      'negativeMarking', 'passingPercentage', 'isFree',
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        // Clean questions array if present
        if (field === 'questions' && Array.isArray(req.body[field])) {
          exam[field] = req.body[field].map(q => {
            const { _id, ...questionWithoutId } = q;
            return questionWithoutId;
          });
        } else {
          exam[field] = req.body[field];
        }
      }
    });

    // Sync isPublished with status if status was updated
    if (req.body.status) {
      exam.isPublished = req.body.status === 'published';
    }

    await exam.save();

    res.status(200).json({
      success: true,
      message: 'Exam updated successfully',
      exam,
    });
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Delete exam (Tutor only)
// @route   DELETE /api/exams/:id
export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id).populate({
      path: 'courseId',
      populate: {
        path: 'tutorId',
      },
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    // Check if user owns the course
    if (exam.courseId.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this exam',
      });
    }

    // Delete all attempts for this exam
    await ExamAttempt.deleteMany({ examId: id });

    await exam.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Exam deleted successfully',
    });
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// @desc    Submit exam (Student)
// @route   POST /api/exams/:id/submit
// @desc    Submit exam (Student)
// @route   POST /api/exams/:id/submit
// In examController.js - Update submitExam function

export const submitExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers, timeSpent, startedAt } = req.body;

    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    // Check enrollment (skip if free)
    if (!exam.isFree) {
      const enrollment = await Enrollment.findOne({
        studentId: req.user.id,
        courseId: exam.courseId,
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You must be enrolled in the course to take this exam',
        });
      }
    }

    // Check previous attempts
    const attemptCount = await ExamAttempt.countDocuments({
      examId: id,
      studentId: req.user.id,
    });

    if (!exam.allowRetake && attemptCount > 0) {
      return res.status(403).json({
        success: false,
        message: 'You have already taken this exam',
      });
    }

    if (exam.maxAttempts && attemptCount >= exam.maxAttempts) {
      return res.status(403).json({
        success: false,
        message: 'Maximum attempts reached',
      });
    }

    // Calculate score
    let score = 0;

    // Build detailed answer array with question data
    const processedAnswers = answers.map((ans) => {
      const question = exam.questions.id(ans.questionId);

      if (!question) {
        return {
          questionId: ans.questionId,
          selectedOption: ans.selectedOption,
          isCorrect: false,
          pointsEarned: 0,
        };
      }

      // If we have selectedOptionText, use it to find the correct option (handles shuffled options)
      let isCorrect = false;
      let selectedOptionIndex = ans.selectedOption;

      if (ans.selectedOptionText && ans.selectedOption !== -1) {
        // Find the option by text in the original question
        const optionByText = question.options.find(opt => opt.text === ans.selectedOptionText);
        if (optionByText) {
          isCorrect = optionByText.isCorrect || false;
        }
      } else if (ans.selectedOption !== -1) {
        // Fallback: use index (old behavior for backward compatibility)
        isCorrect = question.options[ans.selectedOption]?.isCorrect || false;
      }

      // Calculate points
      let pointsEarned = 0;
      if (isCorrect) {
        pointsEarned = question.points || 1;
      } else if (ans.selectedOption !== -1 && exam.negativeMarking) {
        // Negative marking: Deduct 25% of question points
        pointsEarned = -0.25 * (question.points || 1);
      }

      score += pointsEarned;

      // Find correct option index in original question
      const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);

      return {
        questionId: ans.questionId,
        selectedOption: selectedOptionIndex,
        isCorrect,
        pointsEarned,

        // Include full question data for review
        questionData: {
          question: question.question,
          options: question.options.map(opt => ({ text: opt.text })),
          correctOption: correctOptionIndex,
          explanation: question.explanation || null,
          points: question.points,
          difficulty: question.difficulty,
        },
      };
    });

    // Ensure score doesn't go below 0
    score = Math.max(0, score);

    const percentage = Math.round((score / exam.totalMarks) * 100);

    // Determine Pass/Fail
    // 1. If passingPercentage is set (> 0), use it
    // 2. Else if passingMarks is set, use it
    // 3. Fallback to default 33%
    let isPassed = false;
    if (exam.passingPercentage > 0) {
      isPassed = percentage >= exam.passingPercentage;
    } else {
      isPassed = score >= (exam.passingMarks || (exam.totalMarks * 0.33));
    }

    // Create attempt
    const attempt = await ExamAttempt.create({
      examId: id,
      studentId: req.user.id,
      courseId: exam.courseId,
      attemptNumber: attemptCount + 1,
      answers: processedAnswers,
      score,
      percentage,
      isPassed,
      timeSpent,
      startedAt: new Date(startedAt),
      submittedAt: new Date(),
    });

    // Update exam statistics
    exam.attemptCount += 1;
    const allAttempts = await ExamAttempt.find({ examId: id });
    exam.averageScore = allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length;
    await exam.save();

    // ✅ NEW: Check if results should be shown immediately
    if (!exam.showResultImmediately) {
      // Don't show results - just confirmation
      return res.status(200).json({
        success: true,
        message: 'Exam submitted successfully',
        showResultImmediately: false,
        attemptId: attempt._id,
        submittedAt: attempt.submittedAt,
      });
    }

    // ✅ Show full results
    const attemptResponse = {
      score,
      percentage,
      isPassed,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      attemptNumber: attemptCount + 1,
      timeSpent,

      // Include answers for review
      answers: processedAnswers.map(ans => {
        const response = {
          questionId: ans.questionId,
          selectedOption: ans.selectedOption,
          isCorrect: ans.isCorrect,
          pointsEarned: ans.pointsEarned,
          questionData: ans.questionData,
        };

        // Only show correct answer if setting allows
        if (!exam.showCorrectAnswers) {
          delete response.questionData.correctOption;
          delete response.questionData.explanation;
        }

        return response;
      }),

      // Exam settings for UI logic
      showCorrectAnswers: exam.showCorrectAnswers,
      showResultImmediately: exam.showResultImmediately,
    };

    res.status(200).json({
      success: true,
      message: 'Exam submitted successfully',
      showResultImmediately: true,
      attemptId: attempt._id,
      attempt: attemptResponse,
    });
  } catch (error) {
    console.error('Submit exam error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
// @desc    Get exam attempts (Student or Tutor)
// @route   GET /api/exams/:id/attempts
export const getExamAttempts = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id).populate({
      path: 'courseId',
      populate: {
        path: 'tutorId',
      },
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    const isOwner = exam.courseId.tutorId.userId.toString() === req.user.id;

    let attempts;
    if (isOwner) {
      // Tutor can see all attempts
      attempts = await ExamAttempt.find({ examId: id })
        .populate('studentId', 'name email')
        .sort({ createdAt: -1 });
    } else {
      // Student can only see their own attempts
      attempts = await ExamAttempt.find({
        examId: id,
        studentId: req.user.id,
      }).sort({ createdAt: -1 });
    }

    res.status(200).json({
      success: true,
      count: attempts.length,
      attempts,
    });
  } catch (error) {
    console.error('Get exam attempts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};


// @desc    Get Student's Own Attempt History for an Exam
// @route   GET /api/exams/:examId/my-attempts
// @access  Private (Student)
// Get ALL attempts for the logged-in student (Global History)
export const getMyAllAttempts = async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({ studentId: req.user._id })
      .sort({ submittedAt: -1 })
      .populate('examId', 'title totalMarks passingMarks'); // Populate exam details

    const formattedAttempts = attempts.map(attempt => ({
      _id: attempt._id,
      examId: attempt.examId._id,
      examTitle: attempt.examId?.title || 'Unknown Exam',
      score: attempt.score,
      totalMarks: attempt.examId?.totalMarks || 0, // Fallback
      percentage: attempt.percentage,
      isPassed: attempt.isPassed, // Use stored pass status
      date: attempt.submittedAt
    }));

    res.status(200).json({
      success: true,
      attempts: formattedAttempts
    });
  } catch (error) {
    console.error('Error fetching my attempts:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

export const getMyExamAttempts = async (req, res) => {
  try {
    const { examId } = req.params;
    const studentId = req.user.id;

    // Verify exam exists
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    // Get all attempts for this student
    const attempts = await ExamAttempt.find({
      examId,
      studentId,
    })
      .sort({ submittedAt: -1 }) // Most recent first
      .select('-answers'); // Don't send detailed answers in list

    // Calculate summary stats
    const stats = {
      totalAttempts: attempts.length,
      bestScore: attempts.length > 0
        ? Math.max(...attempts.map(a => a.score))
        : 0,
      averageScore: attempts.length > 0
        ? Math.round(
          attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
        )
        : 0,
      passed: attempts.some(a => a.isPassed),
    };

    res.status(200).json({
      success: true,
      attempts,
      stats,
      exam: {
        id: exam._id,
        title: exam.title,
        passingMarks: exam.passingMarks,
        allowRetake: exam.allowRetake,
        maxAttempts: exam.maxAttempts,
      },
    });
  } catch (error) {
    console.error('Get my attempts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get attempts',
    });
  }
};

// @desc    Get Single Attempt Details (with answers)
// @route   GET /api/exams/attempt/:attemptId
// @access  Private (Student - own attempts only)
export const getAttemptDetails = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user.id;

    const attempt = await ExamAttempt.findById(attemptId).populate('examId');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found',
      });
    }

    // Check authorization (student can only view their own)
    if (attempt.studentId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const exam = attempt.examId;

    // Build detailed results with questions
    const detailedResults = exam.questions.map((q, index) => {
      const studentAnswer = attempt.answers.find(
        a => a.questionId.toString() === q._id.toString()
      );
      // Handle boolean or string 'true' for isCorrect (safety check)
      const correctIndex = q.options.findIndex(opt => opt.isCorrect === true || opt.isCorrect === 'true');

      return {
        questionNumber: index + 1,
        question: q.question,
        options: q.options.map(opt => opt.text),
        correctIndex,
        selectedIndex: studentAnswer?.selectedOption ?? -1, // Fix: use selectedOption
        isCorrect: studentAnswer?.isCorrect ?? false,
        explanation: q.explanation,
        pointsEarned: studentAnswer?.pointsEarned ?? 0,
        pointsPossible: q.points || 1,
      };
    });

    res.status(200).json({
      success: true,
      attempt,
      exam: {
        title: exam.title,
        showCorrectAnswers: exam.showCorrectAnswers,
      },
      detailedResults: (exam.showCorrectAnswers && !exam.hideSolutions) ? detailedResults : null,
      hideSolutions: exam.hideSolutions // Inform frontend
    });
  } catch (error) {
    console.error('Get attempt details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get attempt details',
    });
  }
};

// @desc    Get All Attempts for an Exam (Tutor only)
// @route   GET /api/exams/:examId/all-attempts
// @access  Private (Tutor)
export const getAllExamAttempts = async (req, res) => {
  try {
    const { examId } = req.params;

    // Verify exam exists and user owns it
    const exam = await Exam.findById(examId).populate('tutorId');
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    if (exam.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Get all attempts with student info
    const attempts = await ExamAttempt.find({ examId })
      .populate('studentId', 'name email')
      .sort({ submittedAt: -1 })
      .select('-answers'); // Don't send detailed answers in list

    // Group by student
    const studentStats = {};
    attempts.forEach(attempt => {
      if (!attempt.studentId) return; // Skip if student deleted
      const studentId = attempt.studentId._id.toString();
      if (!studentStats[studentId]) {
        studentStats[studentId] = {
          student: attempt.studentId,
          attempts: [],
          bestScore: 0,
          totalAttempts: 0,
          passed: false,
        };
      }

      studentStats[studentId].attempts.push(attempt);
      studentStats[studentId].totalAttempts++;
      studentStats[studentId].bestScore = Math.max(
        studentStats[studentId].bestScore,
        attempt.score
      );
      if (attempt.isPassed) {
        studentStats[studentId].passed = true;
      }
    });

    // Convert to array
    const groupedData = Object.values(studentStats);

    // Overall stats
    const overallStats = {
      totalAttempts: attempts.length,
      uniqueStudents: groupedData.length,
      averageScore: attempts.length > 0
        ? Math.round(
          attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
        )
        : 0,
      passedCount: groupedData.filter(s => s.passed).length,
      passRate: groupedData.length > 0
        ? Math.round(
          (groupedData.filter(s => s.passed).length / groupedData.length) * 100
        )
        : 0,
    };

    res.status(200).json({
      success: true,
      attempts: groupedData,
      overallStats,
      exam: {
        id: exam._id,
        title: exam.title,
        passingMarks: exam.passingMarks,
      },
    });
  } catch (error) {
    console.error('Get all attempts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get attempts',
    });
  }
};

// @desc    Get Specific Student's Attempt Details (Tutor only)
// @route   GET /api/exams/tutor/attempt/:attemptId
// @access  Private (Tutor)
export const getTutorAttemptDetails = async (req, res) => {
  try {
    const { attemptId } = req.params;

    const attempt = await ExamAttempt.findById(attemptId)
      .populate('examId')
      .populate('studentId', 'name email');

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found',
      });
    }

    const exam = attempt.examId;

    // Verify tutor owns this exam
    const fullExam = await Exam.findById(exam._id).populate('tutorId');
    if (fullExam.tutorId.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Build detailed results
    const detailedResults = exam.questions.map((q, index) => {
      const studentAnswer = attempt.answers.find(
        a => a.questionId.toString() === q._id.toString()
      );
      const correctIndex = q.options.findIndex(opt => opt.isCorrect);

      return {
        questionNumber: index + 1,
        question: q.question,
        options: q.options.map(opt => opt.text),
        correctIndex,
        selectedIndex: studentAnswer?.selectedOption ?? -1,
        selectedText: studentAnswer?.selectedOptionText || null, // Direct text from shuffled selection
        isCorrect: studentAnswer?.isCorrect ?? false,
        explanation: q.explanation,
        pointsEarned: studentAnswer?.pointsEarned ?? 0,
        pointsPossible: q.points || 1,
      };
    });

    res.status(200).json({
      success: true,
      attempt,
      student: attempt.studentId,
      exam: {
        title: exam.title,
      },
      detailedResults,
    });

  } catch (error) {
    console.error('Get tutor attempt details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get attempt details',
    });
  }
}

// @desc    Get all exams created by a Tutor
// @route   GET /api/exams/tutor/all
export const getExamsByTutor = async (req, res) => {
  try {
    const userId = req.user.id;

    // Use aggregate to lookup course, then match course.tutorId.userId == req.user.id
    const exams = await Exam.aggregate([
      {
        $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      { $unwind: '$course' },
      {
        $lookup: {
          from: 'tutors',
          localField: 'course.tutorId',
          foreignField: '_id',
          as: 'tutor'
        }
      },
      { $unwind: '$tutor' },
      {
        $match: {
          'tutor.userId': new mongoose.Types.ObjectId(req.user.id)
        }
      },
      {
        $project: {
          title: 1,
          courseTitle: '$course.title',
          status: 1,
          createdAt: 1,
          totalMarks: 1,
          duration: 1,
          attemptCount: 1,
          averageScore: 1,
          courseId: '$course._id',
          type: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.status(200).json({
      success: true,
      exams
    });
  } catch (error) {
    console.error('Get tutor exams error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all exams available to a Student (Enrolled Course Exams + Public Practice Sets)
// @route   GET /api/exams/student/all
export const getStudentExams = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get Student's Enrollments
    const enrollments = await Enrollment.find({ studentId: userId, status: 'active' });
    const enrolledCourseIds = enrollments.map(e => e.courseId);

    // 2. Find Exams
    // - Belong to enrolled courses AND are published AND (quiz/midterm/final)
    // - OR are Public Practice Sets
    const exams = await Exam.aggregate([
      {
        $match: {
          status: 'published',
          $or: [
            { courseId: { $in: enrolledCourseIds } }, // Access via enrollment
            { isPublic: true }, // Publicly accessible
            { type: 'practice' } // All practice sets (refine if needed)
          ]
        }
      },
      // Lookup Course details
      {
        $lookup: {
          from: 'courses',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course'
        }
      },
      { $unwind: '$course' },
      // Lookup Student's attempts for each exam
      {
        $lookup: {
          from: 'examattempts',
          let: { examId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$examId', '$$examId'] },
                    { $eq: ['$studentId', new mongoose.Types.ObjectId(userId)] }
                  ]
                }
              }
            },
            { $project: { score: 1, isPassed: 1, submittedAt: 1 } }
          ],
          as: 'myAttempts'
        }
      },
      {
        $addFields: {
          myAttemptCount: { $size: '$myAttempts' },
          lastAttempt: { $last: '$myAttempts' },
          courseTitle: '$course.title'
        }
      },
      {
        $project: {
          title: 1,
          type: 1,
          duration: 1,
          totalQuestions: 1,
          passingPercentage: 1,
          difficulty: 1,
          startDate: 1,
          endDate: 1,
          isScheduled: 1,
          courseTitle: 1,
          courseId: 1,
          myAttemptCount: 1,
          lastAttempt: 1,
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.status(200).json({
      success: true,
      exams
    });
  } catch (error) {
    console.error('Get student exams error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};
