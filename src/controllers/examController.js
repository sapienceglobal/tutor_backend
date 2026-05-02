import { Exam, ExamAttempt } from '../models/Exam.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import mongoose from 'mongoose';
import {
  buildAttemptQuestionResults,
  evaluatePass,
  normalizePassingConfig,
} from '../utils/examScoring.js';
import { featureFlags } from '../config/featureFlags.js';
import { getForUser as getEntitlementsForUser } from '../services/entitlementService.js';
import { evaluateAccess } from '../services/accessPolicy.js';
import { emitLearningEvent } from '../services/learningEventService.js';
import {
  AUDIENCE_SCOPES,
  normalizeAudienceInput,
  validateAudience,
} from '../utils/audience.js';

const resolveExamAudience = ({ body, tenant, fallbackBatchId = null, fallbackInstituteId = null }) => {
  const normalizedAudience = normalizeAudienceInput({
    audience: body.audience,
    scope: body.scope,
    instituteId: body.instituteId || fallbackInstituteId || tenant?._id || null,
    batchId: body.batchId || fallbackBatchId || null,
    batchIds: body.batchIds || [],
    studentIds: body.studentIds || [],
  }, {
    defaultScope: (body.batchId || fallbackBatchId)
      ? AUDIENCE_SCOPES.BATCH
      : ((body.instituteId || fallbackInstituteId || tenant?._id) ? AUDIENCE_SCOPES.INSTITUTE : AUDIENCE_SCOPES.GLOBAL),
    defaultInstituteId: body.instituteId || fallbackInstituteId || tenant?._id || null,
  });

  return validateAudience(normalizedAudience, {
    requireInstituteId: false,
    allowEmptyPrivate: false,
  });
};

// @desc    Get all exams for a course (Tutor)
// @route   GET /api/exams/course/:courseId
export const getExamsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user.id; // Assuming user is authenticated

    // Aggregation Pipeline to merge Exam data with Student's Attempts
    const matchQuery = {
      courseId: new mongoose.Types.ObjectId(courseId),
      status: 'published' // Only show published exams to students
    };

    // If student, find their batchId from enrollment
    if (req.user.role === 'student') {
      const enrollment = await Enrollment.findOne({ studentId: req.user.id, courseId, status: 'active' });
      if (enrollment && enrollment.batchId) {
        matchQuery.$or = [
          { batchId: enrollment.batchId },
          { batchId: null }
        ];
      } else {
        matchQuery.batchId = null;
      }
    }
    if (req.tenant) matchQuery.instituteId = new mongoose.Types.ObjectId(req.tenant._id);

    let exams = await Exam.aggregate([
      {
        $match: matchQuery
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

    let visibleExams = exams;
    if (featureFlags.audienceEnforceV2 && req.user.role === 'student') {
      const entitlements = await getEntitlementsForUser(req.user);
      visibleExams = exams.filter((exam) => evaluateAccess({
        resource: exam,
        entitlements,
        requireEnrollment: true,
        requirePayment: !exam.isFree,
        isFree: exam.isFree,
        courseId: exam.courseId,
      }).allowed);
    }

    res.status(200).json({
      success: true,
      exams: visibleExams,
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

    if (!isOwner && featureFlags.audienceEnforceV2) {
      const entitlements = await getEntitlementsForUser(req.user);
      const accessDecision = evaluateAccess({
        resource: exam,
        entitlements,
        requireEnrollment: !exam.isFree,
        requirePayment: !exam.isFree,
        isFree: exam.isFree,
        courseId: exam.courseId._id,
      });
      if (!accessDecision.allowed) {
        return res.status(403).json({
          success: false,
          message: 'Exam is not available in your current audience scope',
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
      hideSolutions,
      sections,
      isAdaptive,
      batchId,
      isProctoringEnabled,
      isAudioProctoringEnabled,
      strictTabSwitching,
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
      if (questionWithoutId.type && !questionWithoutId.questionType) {
        questionWithoutId.questionType = questionWithoutId.type;
      }
      return questionWithoutId;
    });

    const examStatus = status || 'published';
    const totalMarksFromQuestions = cleanedQuestions.reduce((sum, question) => sum + (question.points || 1), 0);
    const normalizedPassing = normalizePassingConfig(
      { passingPercentage, passingMarks },
      totalMarksFromQuestions
    );
    let audience;
    try {
      audience = resolveExamAudience({
        body: req.body,
        tenant: req.tenant,
        fallbackBatchId: batchId || null,
        fallbackInstituteId: course.instituteId || req.tenant?._id || null,
      });
    } catch (audienceError) {
      return res.status(400).json({
        success: false,
        message: audienceError.message,
      });
    }

    if (
      course.instituteId
      && audience.scope === AUDIENCE_SCOPES.GLOBAL
      && req.tenant?.features?.allowGlobalPublishingByInstituteTutors !== true
    ) {
      return res.status(403).json({
        success: false,
        message: 'Institute policy blocks global publishing for institute tutors',
      });
    }

    const exam = await Exam.create({
      courseId,
      batchId: audience.scope === AUDIENCE_SCOPES.BATCH ? (audience.batchIds[0] || null) : null,
      tutorId: course.tutorId._id,
      instituteId: audience.scope === AUDIENCE_SCOPES.GLOBAL
        ? null
        : (audience.instituteId || course.instituteId || req.tenant?._id || null),
      title,
      description,
      type: type || 'assessment',
      instructions,
      duration,
      passingMarks: normalizedPassing.passingMarks,
      questions: cleanedQuestions,
      shuffleQuestions: shuffleQuestions || false,
      shuffleOptions: shuffleOptions || false,
      showResultImmediately: showResultImmediately || false,
      showCorrectAnswers: showCorrectAnswers !== undefined ? showCorrectAnswers : true,
      hideSolutions: hideSolutions || false,
      allowRetake: allowRetake || false,
      maxAttempts: maxAttempts || 1,
      startDate,
      endDate,
      isScheduled: !!(startDate && endDate),
      status: examStatus,
      isPublished: examStatus === 'published',
      negativeMarking: negativeMarking || false,
      passingPercentage: normalizedPassing.passingPercentage,
      isFree: isFree || false,
      sections: sections || [],
      isAdaptive: isAdaptive || false,
      isProctoringEnabled: isProctoringEnabled || false,
      isAudioProctoringEnabled: isAudioProctoringEnabled || false,
      strictTabSwitching: strictTabSwitching || false,
      audience,
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
      'negativeMarking', 'passingPercentage', 'isFree', 'sections', 'isAdaptive',
      'batchId', 'audience',
      'isProctoringEnabled', 'isAudioProctoringEnabled', 'strictTabSwitching',
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        // Clean questions array if present
        if (field === 'questions' && Array.isArray(req.body[field])) {
          exam[field] = req.body[field].map(q => {
            const { _id, ...questionWithoutId } = q;
            if (questionWithoutId.type && !questionWithoutId.questionType) {
              questionWithoutId.questionType = questionWithoutId.type;
            }
            return questionWithoutId;
          });
        } else {
          exam[field] = req.body[field];
        }
      }
    });

    if (
      req.body.audience !== undefined
      || req.body.scope !== undefined
      || req.body.batchId !== undefined
      || req.body.batchIds !== undefined
      || req.body.studentIds !== undefined
      || req.body.instituteId !== undefined
    ) {
      let audience;
      try {
        audience = resolveExamAudience({
          body: req.body,
          tenant: req.tenant,
          fallbackBatchId: exam.batchId || null,
          fallbackInstituteId: exam.instituteId || exam.courseId?.instituteId || req.tenant?._id || null,
        });
      } catch (audienceError) {
        return res.status(400).json({
          success: false,
          message: audienceError.message,
        });
      }

      if (
        (exam.instituteId || exam.courseId?.instituteId)
        && audience.scope === AUDIENCE_SCOPES.GLOBAL
        && req.tenant?.features?.allowGlobalPublishingByInstituteTutors !== true
      ) {
        return res.status(403).json({
          success: false,
          message: 'Institute policy blocks global publishing for institute tutors',
        });
      }

      exam.audience = audience;
      exam.batchId = audience.scope === AUDIENCE_SCOPES.BATCH ? (audience.batchIds[0] || null) : null;
      exam.instituteId = audience.scope === AUDIENCE_SCOPES.GLOBAL
        ? null
        : (audience.instituteId || exam.instituteId || req.tenant?._id || null);
    }

    // Sync isPublished with status if status was updated
    if (req.body.status) {
      exam.isPublished = req.body.status === 'published';
    }

    const shouldNormalizePassing = req.body.passingPercentage !== undefined
      || req.body.passingMarks !== undefined
      || req.body.questions !== undefined;
    if (shouldNormalizePassing) {
      const totalMarksFromQuestions = (exam.questions || []).reduce(
        (sum, question) => sum + (question.points || 1),
        0
      );
      const existingPercentage = Number(exam.passingPercentage) || 0;
      const percentageInput = req.body.passingPercentage !== undefined
        ? req.body.passingPercentage
        : (req.body.passingMarks === undefined && existingPercentage > 0 ? exam.passingPercentage : undefined);
      const marksInput = req.body.passingMarks !== undefined
        ? req.body.passingMarks
        : (req.body.passingPercentage === undefined ? exam.passingMarks : undefined);
      const normalizedPassing = normalizePassingConfig(
        { passingPercentage: percentageInput, passingMarks: marksInput },
        totalMarksFromQuestions
      );
      exam.passingPercentage = normalizedPassing.passingPercentage;
      exam.passingMarks = normalizedPassing.passingMarks;
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
    const { answers, timeSpent, startedAt, tabSwitchCount, proctoringEvents } = req.body;

    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    // Check enrollment (skip if free)
    let enrollment = null;
    if (!exam.isFree) {
      enrollment = await Enrollment.findOne({
        studentId: req.user.id,
        courseId: exam.courseId,
        status: 'active'
      });

      if (!enrollment) {
        return res.status(403).json({
          success: false,
          message: 'You must be enrolled in the course to take this exam',
        });
      }

      // If exam is batch-specific, verify student is in that batch
      if (exam.batchId && enrollment.batchId?.toString() !== exam.batchId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'This exam is not available for your batch.'
        });
      }
    }

    if (featureFlags.audienceEnforceV2) {
      const entitlements = await getEntitlementsForUser(req.user);
      const accessDecision = evaluateAccess({
        resource: exam,
        entitlements,
        requireEnrollment: !exam.isFree,
        requirePayment: !exam.isFree,
        isFree: exam.isFree,
        courseId: exam.courseId,
      });
      if (!accessDecision.allowed) {
        return res.status(403).json({
          success: false,
          message: 'Exam is not available in your current audience scope',
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

      let isCorrect = false;
      let pointsEarned = 0;
      let selectedOptionIndex = Number.isInteger(ans.selectedOption) ? ans.selectedOption : -1;

      const qType = question.questionType || 'mcq';

      if (qType === 'mcq' || qType === 'passage_based') {
        // If we have selectedOptionText, use it to find the correct option (handles shuffled options)
        if (typeof ans.selectedOptionText === 'string' && ans.selectedOptionText.trim()) {
          // Find the option by text in the original question
          const optionByText = question.options.find(opt => opt.text === ans.selectedOptionText);
          if (optionByText) {
            isCorrect = optionByText.isCorrect || false;
          }
        } else if (ans.selectedOption !== -1) {
          // Fallback: use index (old behavior for backward compatibility)
          isCorrect = question.options[ans.selectedOption]?.isCorrect || false;
        }

        if (isCorrect) {
          pointsEarned = question.points || 1;
        } else if (ans.selectedOption !== -1 && exam.negativeMarking) {
          pointsEarned = -0.25 * (question.points || 1);
        }
      } else if (qType === 'numeric') {
        if (ans.numericAnswer !== undefined && ans.numericAnswer !== null && question.numericAnswer !== undefined) {
          const studentAns = Number(ans.numericAnswer);
          const correctAns = Number(question.numericAnswer);
          const tolerance = Number(question.tolerance || 0);

          if (Math.abs(studentAns - correctAns) <= tolerance) {
            isCorrect = true;
            pointsEarned = question.points || 1;
          } else if (exam.negativeMarking) {
            pointsEarned = -0.25 * (question.points || 1);
          }
        }
      } else if (qType === 'match_the_following') {
        if (ans.matchAnswers && typeof ans.matchAnswers === 'object' && question.pairs && question.pairs.length > 0) {
          let correctMatches = 0;
          const totalPairs = question.pairs.length;

          question.pairs.forEach(pair => {
            if (ans.matchAnswers[pair.left] === pair.right) {
              correctMatches++;
            }
          });

          if (correctMatches === totalPairs) {
            isCorrect = true;
            pointsEarned = question.points || 1;
          } else if (correctMatches > 0) {
            // Partial points for partial matches
            pointsEarned = parseFloat(((correctMatches / totalPairs) * (question.points || 1)).toFixed(2));
          } else if (exam.negativeMarking && Object.keys(ans.matchAnswers).length > 0) {
            pointsEarned = -0.25 * (question.points || 1);
          }
        }
      }

      score += pointsEarned;

      // Find correct option index in original question (for MCQs)
      const correctOptionIndex = (qType === 'mcq' || qType === 'passage_based') ? question.options.findIndex(opt => opt.isCorrect) : -1;
      const selectedOptionText = (typeof ans.selectedOptionText === 'string' && ans.selectedOptionText.trim())
        ? ans.selectedOptionText.trim()
        : (selectedOptionIndex >= 0 ? question.options[selectedOptionIndex]?.text || null : null);

      return {
        questionId: ans.questionId,
        selectedOption: selectedOptionIndex,
        selectedOptionText,
        numericAnswer: ans.numericAnswer,
        matchAnswers: ans.matchAnswers,
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
          questionType: qType,
          numericAnswer: question.numericAnswer,
          tolerance: question.tolerance,
          pairs: question.pairs
        },
      };
    });

    // Ensure score doesn't go below 0
    score = Math.max(0, score);
    const passEvaluation = evaluatePass({
      score,
      totalMarks: exam.totalMarks,
      passingPercentage: exam.passingPercentage,
      passingMarks: exam.passingMarks,
    });
    const percentage = passEvaluation.displayPercentage;
    const isPassed = passEvaluation.isPassed;

    // --- AI Risk Calculation ---
    const finalTabSwitches = Number(tabSwitchCount) || 0;
    const finalProctoringEvents = Array.isArray(proctoringEvents) ? proctoringEvents : [];
    
    let aiRiskScore = finalTabSwitches * 1.5;
    finalProctoringEvents.forEach(e => {
      if (e.severity === 'critical') aiRiskScore += 3;
      else if (e.severity === 'high') aiRiskScore += 2;
      else if (e.severity === 'medium') aiRiskScore += 1;
      else aiRiskScore += 0.5;
    });

    aiRiskScore = Math.min(10, aiRiskScore); // Cap at 10

    let aiRiskLevel = 'Safe';
    if (aiRiskScore >= 7) aiRiskLevel = 'Cheating';
    else if (aiRiskScore >= 4) aiRiskLevel = 'Suspicious';
    else if (aiRiskScore >= 2) aiRiskLevel = 'Low Confidence';

    let summary = 'Session completed cleanly.';
    if (aiRiskScore >= 4) summary = "Suspicious AI indicators flagged. Score: " + aiRiskScore.toFixed(1) + "/10.";
    if (aiRiskScore >= 7) summary = 'Critical violations detected. Direct instructor review highly recommended.';

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
      tabSwitchCount: finalTabSwitches,
      proctoringEvents: finalProctoringEvents,
      aiRiskScore,
      aiRiskLevel,
      aiProctoringSummary: summary
    });

    // Update exam statistics
    exam.attemptCount += 1;
    const allAttempts = await ExamAttempt.find({ examId: id });
    exam.averageScore = allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length;
    await exam.save();

    // --- Compute Percentile ---
    const allScores = allAttempts.map(a => a.score).sort((a, b) => a - b);
    const rank = allScores.filter(s => s < score).length;
    const percentile = Math.round((rank / allScores.length) * 100);
    attempt.percentile = percentile;
    await attempt.save();

    await emitLearningEvent('exam_submitted', req.user, {
      instituteId: exam.instituteId || req.tenant?._id || null,
      courseId: exam.courseId,
      batchId: exam.batchId || enrollment?.batchId || null,
      resourceId: exam._id,
      resourceType: 'exam',
      meta: {
        score,
        percentage,
        isPassed,
        attemptNumber: attempt.attemptNumber,
      },
    });

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
      passingPercentage: exam.passingPercentage,
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

    const detailedResults = buildAttemptQuestionResults({ exam, attempt });

    res.status(200).json({
      success: true,
      attempt: {
        ...attempt.toObject(),
        percentile: attempt.percentile,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        passingPercentage: exam.passingPercentage,
      },
      exam: {
        title: exam.title,
        showCorrectAnswers: exam.showCorrectAnswers,
        hideSolutions: exam.hideSolutions,
        duration: exam.duration,
      },
      detailedResults,
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
    let exams = await Exam.aggregate([
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

    let visibleExams = exams;
    if (featureFlags.audienceEnforceV2) {
      const entitlements = await getEntitlementsForUser(req.user);
      visibleExams = exams.filter((exam) => evaluateAccess({
        resource: exam,
        entitlements,
        requireEnrollment: !exam.isFree,
        requirePayment: !exam.isFree,
        isFree: exam.isFree,
        courseId: exam.courseId,
      }).allowed);
    }

    res.status(200).json({
      success: true,
      exams: visibleExams
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
    const scope = req.query.scope;
    const shouldResolveEntitlements = scope === 'institute' || featureFlags.audienceEnforceV2 || featureFlags.audienceReadV2Shadow;
    const entitlements = shouldResolveEntitlements ? await getEntitlementsForUser(req.user) : null;
    const allowedInstituteObjectIds = scope === 'institute'
      ? (entitlements?.membershipInstituteIds || [])
        .concat(entitlements?.activeInstituteId ? [entitlements.activeInstituteId] : [])
        .filter(Boolean)
        .filter((id, index, arr) => arr.indexOf(id) === index)
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id))
      : [];

    // 1. Get Student's Enrollments
    const enrollments = await Enrollment.find({ studentId: userId, status: 'active' });
    const enrolledCourseIds = enrollments.map(e => e.courseId);

    // 2. Find Exams
    // - Belong to enrolled courses AND are published AND (quiz/midterm/final)
    // - OR are Public Practice Sets
    let exams = await Exam.aggregate([
      {
        $match: {
          status: 'published',
          $or: [
            { courseId: { $in: enrolledCourseIds } }, // Access via enrollment
            { isPublic: true }, // Publicly accessible
            { isFree: true }, // Free exams accessible to all
            { type: 'practice' } // All practice sets
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
      ...(scope === 'global' ? [{ $match: { 'course.visibility': 'public' } }] : []),
      ...(scope === 'institute'
        ? [
          { $match: { 'course.visibility': 'institute' } },
          ...(allowedInstituteObjectIds.length > 0
            ? [{ $match: { 'course.instituteId': { $in: allowedInstituteObjectIds } } }]
            : [{ $match: { _id: null } }]),
        ]
        : []),
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
          lastAttemptId: { $ifNull: [{ $getField: { field: '_id', input: { $last: '$myAttempts' } } }, null] },
          courseTitle: '$course.title',
          isCompleted: { $gt: [{ $size: '$myAttempts' }, 0] }
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
          isFree: 1,
          courseTitle: 1,
          courseId: 1,
          audience: 1,
          instituteId: 1,
          batchId: 1,
          visibility: '$course.visibility',
          myAttemptCount: 1,
          lastAttempt: 1,
          lastAttemptId: 1,
          isCompleted: 1,
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    if (featureFlags.audienceEnforceV2 || featureFlags.audienceReadV2Shadow) {
      if (featureFlags.audienceEnforceV2) {
        exams = exams.filter((exam) => evaluateAccess({
          resource: exam,
          entitlements,
          requireEnrollment: !exam.isFree,
          requirePayment: !exam.isFree,
          isFree: exam.isFree,
          courseId: exam.courseId,
          legacyAllowed: true,
          shadowContext: {
            route: 'GET /api/exams/student/all',
            resourceType: 'exam',
          },
        }).allowed);
      } else {
        exams.forEach((exam) => {
          evaluateAccess({
            resource: exam,
            entitlements,
            requireEnrollment: !exam.isFree,
            requirePayment: !exam.isFree,
            isFree: exam.isFree,
            courseId: exam.courseId,
            legacyAllowed: true,
            shadowContext: {
              route: 'GET /api/exams/student/all',
              resourceType: 'exam',
            },
          });
        });
      }
    }

    res.status(200).json({
      success: true,
      exams
    });
  } catch (error) {
    console.error('Get student exams error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get next adaptive question
// @route   POST /api/student/exams/:id/next-question
// @access  Private (Student)
export const getNextAdaptiveQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { answeredQuestionIds = [], lastAnswerCorrect } = req.body;

    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    if (!exam.isAdaptive) {
      return res.status(400).json({ success: false, message: 'This exam is not adaptive' });
    }

    // Filter out already answered questions
    const answeredSet = new Set(answeredQuestionIds.map(String));
    const unanswered = exam.questions.filter(q => !answeredSet.has(q._id.toString()));

    if (unanswered.length === 0) {
      return res.status(200).json({
        success: true,
        finished: true,
        message: 'All questions answered',
      });
    }

    // Determine target difficulty
    let targetDifficulty = 'medium'; // default start
    if (answeredQuestionIds.length > 0) {
      if (lastAnswerCorrect === true) {
        targetDifficulty = 'hard';
      } else if (lastAnswerCorrect === false) {
        targetDifficulty = 'easy';
      }
    }

    // Pick from target difficulty, fallback to any unanswered
    let nextQuestion = unanswered.find(q => q.difficulty === targetDifficulty);
    if (!nextQuestion) {
      // Fallback: try medium, then any
      nextQuestion = unanswered.find(q => q.difficulty === 'medium') || unanswered[0];
    }

    // Strip correct answer info
    const safeQuestion = {
      _id: nextQuestion._id,
      question: nextQuestion.question,
      options: nextQuestion.options.map(opt => ({ text: opt.text, _id: opt._id })),
      difficulty: nextQuestion.difficulty,
      points: nextQuestion.points,
    };

    res.status(200).json({
      success: true,
      finished: false,
      question: safeQuestion,
      remainingCount: unanswered.length - 1,
      totalQuestions: exam.questions.length,
    });
  } catch (error) {
    console.error('Adaptive question error:', error);
    res.status(500).json({ success: false, message: 'Failed to get next question' });
  }
};
