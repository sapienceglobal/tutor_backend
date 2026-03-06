import { Exam, ExamAttempt } from '../models/Exam.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import mongoose from 'mongoose';
import {
    buildAttemptQuestionResults,
    evaluatePass,
} from '../utils/examScoring.js';
import { featureFlags } from '../config/featureFlags.js';
import { getForUser as getEntitlementsForUser } from '../services/entitlementService.js';
import { evaluateAccess } from '../services/accessPolicy.js';
import { emitLearningEvent } from '../services/learningEventService.js';

// @desc    Get all exam attempts for analytics
// @route   GET /api/student/exams/history-all
export const getExamHistory = async (req, res) => {
    try {
        const studentId = req.user.id;

        // Get student's enrollments to filter attempts
        const enrollments = await Enrollment.find({ studentId });
        const enrolledCourseIds = enrollments.map(e => e.courseId.toString());

        // Get all exam attempts with exam details
        const attempts = await ExamAttempt.find({ studentId })
            .populate({
                path: 'examId',
                select: 'title courseId totalQuestions duration',
                populate: {
                    path: 'courseId',
                    select: 'title'
                }
            })
            .sort({ submittedAt: -1 });

        // Filter attempts to only include exams from enrolled courses
        // But allow attempts even if no enrollments exist (for students who took exams before enrollment)
        let filteredAttempts;
        if (enrolledCourseIds.length > 0) {
            filteredAttempts = attempts.filter(attempt =>
                attempt.examId?.courseId &&
                enrolledCourseIds.includes(attempt.examId.courseId._id.toString())
            );
        } else {
            // If no enrollments, return all attempts (student might have taken exams before enrollment)
            filteredAttempts = attempts.filter(attempt =>
                attempt.examId?.courseId
            );
        }

        // Format attempts for frontend
        const formattedAttempts = filteredAttempts.map(attempt => ({
            _id: attempt._id,
            examId: attempt.examId._id,
            examTitle: attempt.examId.title,
            courseTitle: attempt.examId.courseId?.title || 'Unknown Course',
            score: attempt.score,
            totalMarks: attempt.totalMarks || attempt.examId?.totalQuestions || 0,
            submittedAt: attempt.submittedAt,
            date: attempt.submittedAt,
            isPassed: attempt.isPassed
        }));

        res.status(200).json({
            success: true,
            attempts: formattedAttempts
        });

    } catch (error) {
        console.error('Get exam history error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get all published exams (Student Portal)
// @route   GET /api/student/exams/all
export const getAllExams = async (req, res) => {
    try {
        const studentId = req.user.id;

        // Fetch all published exams
        const exams = await Exam.find({ status: 'published' })
            .populate({
                path: 'courseId',
                select: 'title tutorId',
                populate: {
                    path: 'tutorId',
                    select: 'userId',
                    populate: {
                        path: 'userId',
                        select: 'name'
                    }
                }
            })
            .sort({ createdAt: -1 });

        // Get student's enrollments to filter exams
        const enrollments = await Enrollment.find({ studentId });
        const enrolledCourseIds = enrollments.map(e => e.courseId.toString());

        // Get student's attempts to show status
        const myAttempts = await ExamAttempt.find({ studentId });
        const entitlements = (featureFlags.audienceEnforceV2 || featureFlags.audienceReadV2Shadow)
            ? await getEntitlementsForUser(req.user)
            : null;

        const processedExams = exams.map(exam => {
            if (!exam.courseId) return null; // Skip if course deleted

            // Only include exams from enrolled courses
            // But if no enrollments, show no exams (better UX than showing all exams they can't access)
            if (enrolledCourseIds.length > 0 && !enrolledCourseIds.includes(exam.courseId._id.toString())) return null;

            // If no enrollments, don't show any exams (student needs to enroll first)
            if (enrolledCourseIds.length === 0) return null;

            if (entitlements) {
                const accessDecision = evaluateAccess({
                    resource: exam,
                    entitlements,
                    requireEnrollment: !exam.isFree,
                    requirePayment: !exam.isFree,
                    isFree: exam.isFree,
                    courseId: exam.courseId?._id,
                    legacyAllowed: true,
                    shadowContext: {
                        route: 'GET /api/student/exams/all',
                        resourceType: 'exam',
                    },
                });
                if (featureFlags.audienceEnforceV2 && !accessDecision.allowed) return null;
            }

            const attempts = myAttempts.filter(a => a.examId.toString() === exam._id.toString());
            const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;

            return {
                _id: exam._id,
                title: exam.title,
                duration: exam.duration,
                totalQuestions: exam.totalQuestions,
                difficulty: 'Medium', // Placeholder or derive from questions
                startDate: exam.startDate,
                endDate: exam.endDate,
                isScheduled: exam.isScheduled,
                // Tutor Details
                tutorName: exam.courseId?.tutorId?.userId?.name || 'Unknown Tutor',
                courseTitle: exam.courseId?.title,
                // Attempt Info
                attemptCount: attempts.length,
                lastAttempt: lastAttempt ? {
                    _id: lastAttempt._id,
                    score: lastAttempt.score,
                    isPassed: lastAttempt.isPassed,
                    submittedAt: lastAttempt.submittedAt
                } : null,
                isCompleted: !!lastAttempt?.isPassed
            };
        }).filter(Boolean);

        res.status(200).json({
            success: true,
            exams: processedExams
        });

    } catch (error) {
        console.error('Get all exams error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get Single Exam for Taking Loop (Student Portal)
// @route   GET /api/student/exams/:id
export const getExamById = async (req, res) => {
    try {
        const { id } = req.params;
        const exam = await Exam.findById(id).lean();

        if (!exam || exam.status !== 'published') {
            return res.status(404).json({ success: false, message: 'Exam not found or not available' });
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

        // Security: Remove correct answers
        const secureQuestions = exam.questions.map(q => ({
            _id: q._id,
            question: q.question,
            options: q.options.map(opt => ({
                _id: opt._id,
                text: opt.text
            })),
            points: q.points,
            type: q.type
        }));

        res.status(200).json({
            success: true,
            exam: {
                _id: exam._id,
                title: exam.title,
                duration: exam.duration,
                instructions: exam.instructions,
                questions: secureQuestions,
                totalMarks: exam.totalMarks,
                sections: exam.sections || [],
                isAdaptive: exam.isAdaptive || false,
            }
        });

    } catch (error) {
        console.error('Get exam error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Submit Exam (Student Portal)
// @route   POST /api/student/exams/:id/submit
export const submitExam = async (req, res) => {
    try {
        const { id } = req.params;
        const { answers, timeSpent, startedAt } = req.body;
        const studentId = req.user.id;

        const exam = await Exam.findById(id);
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

        let enrollment = null;
        if (!exam.isFree) {
            enrollment = await Enrollment.findOne({
                studentId,
                courseId: exam.courseId,
                status: 'active',
            });

            if (!enrollment) {
                return res.status(403).json({
                    success: false,
                    message: 'You must be enrolled in the course to take this exam',
                });
            }

            if (exam.batchId && enrollment.batchId?.toString() !== exam.batchId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'This exam is not available for your batch',
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

        let score = 0;
        const attemptCount = await ExamAttempt.countDocuments({ examId: id, studentId });

        const processedAnswers = answers.map(ans => {
            const question = exam.questions.id(ans.questionId);
            if (!question) return null;

            const isSubjective = !question.options || question.options.length === 0;

            if (isSubjective) {
                // Subjective question — store textAnswer, mark for manual review
                return {
                    questionId: question._id,
                    selectedOption: -1,
                    textAnswer: ans.textAnswer || '',
                    isCorrect: false,
                    pendingReview: true,
                    pointsEarned: 0
                };
            }

            // MCQ / option-based auto-grading
            const selectedOptIndex = Number.isInteger(ans.selectedOption) ? ans.selectedOption : -1;
            const selectedOptionText = (typeof ans.selectedOptionText === 'string' && ans.selectedOptionText.trim())
                ? ans.selectedOptionText.trim()
                : (selectedOptIndex >= 0 ? question.options[selectedOptIndex]?.text || null : null);
            const optionByText = selectedOptionText
                ? question.options.find(opt => opt.text === selectedOptionText)
                : null;
            const isCorrect = optionByText
                ? optionByText.isCorrect || false
                : (selectedOptIndex >= 0 ? question.options[selectedOptIndex]?.isCorrect || false : false);

            if (isCorrect) {
                score += question.points || 1;
            } else if (exam.negativeMarking && selectedOptIndex !== -1 && selectedOptIndex !== null) {
                score -= (question.points || 1) * 0.25;
            }

            return {
                questionId: question._id,
                selectedOption: selectedOptIndex,
                selectedOptionText,
                isCorrect,
                pointsEarned: isCorrect ? (question.points || 1) : 0
            };
        }).filter(Boolean);

        score = Math.max(0, score);
        const passEvaluation = evaluatePass({
            score,
            totalMarks: exam.totalMarks,
            passingPercentage: exam.passingPercentage,
            passingMarks: exam.passingMarks,
        });
        const percentage = passEvaluation.displayPercentage;
        const isPassed = passEvaluation.isPassed;

        const attempt = await ExamAttempt.create({
            examId: id,
            studentId,
            courseId: exam.courseId,
            attemptNumber: attemptCount + 1,
            answers: processedAnswers,
            score,
            percentage,
            isPassed,
            timeSpent,
            startedAt: startedAt ? new Date(startedAt) : new Date(),
            submittedAt: new Date()
        });

        // --- Compute Percentile ---
        const allAttempts = await ExamAttempt.find({ examId: id });
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

        res.status(200).json({
            success: true,
            score,
            isPassed,
            percentage,
            percentile,
            attemptId: attempt._id
        });

    } catch (error) {
        console.error('Submit exam error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get Attempt Details (Result)
// @route   GET /api/student/exams/attempt/:id
export const getAttemptDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const studentId = req.user.id;

        const attempt = await ExamAttempt.findOne({ _id: id, studentId })
            .populate('examId', 'title totalMarks passingPercentage passingMarks duration totalQuestions questions showCorrectAnswers hideSolutions');

        if (!attempt) {
            return res.status(404).json({ success: false, message: 'Result not found' });
        }

        const detailedAnalysis = buildAttemptQuestionResults({
            exam: attempt.examId,
            attempt,
        }).map((item) => ({
            _id: item.questionId,
            questionNumber: item.questionNumber,
            question: item.question,
            options: item.options,
            points: item.pointsPossible,
            userSelectedOption: item.selectedIndex,
            selectedAnswerText: item.selectedAnswerText,
            isCorrect: item.isCorrect,
            status: item.status,
            correctOption: item.correctIndex,
            correctAnswerText: item.correctAnswerText,
            canViewCorrectAnswer: item.canViewCorrectAnswer,
            canViewSolution: item.canViewSolution,
            solutionText: item.solutionText,
            pointsEarned: item.pointsEarned,
            pointsPossible: item.pointsPossible,
        }));
        const correctCount = detailedAnalysis.filter(item => item.status === 'correct').length;
        const incorrectCount = detailedAnalysis.filter(item => item.status === 'incorrect').length;
        const unansweredCount = detailedAnalysis.filter(item => item.status === 'unanswered').length;

        res.status(200).json({
            success: true,
            attempt: {
                _id: attempt._id,
                examId: attempt.examId._id,
                examTitle: attempt.examId.title,
                totalMarks: attempt.examId.totalMarks,
                passingPercentage: attempt.examId.passingPercentage,
                passingMarks: attempt.examId.passingMarks,
                score: attempt.score,
                percentage: attempt.percentage,
                isPassed: attempt.isPassed,
                timeSpent: attempt.timeSpent,
                submittedAt: attempt.submittedAt,
                percentile: attempt.percentile,
                totalQuestions: attempt.examId.totalQuestions,
                showCorrectAnswers: attempt.examId.showCorrectAnswers,
                hideSolutions: attempt.examId.hideSolutions,
                correctCount,
                incorrectCount,
                unansweredCount,
                analysis: detailedAnalysis
            }
        });

    } catch (error) {
        console.error('Get result error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Log tab switch during exam (test integrity)
// @route   POST /api/student/exams/:id/tab-switch
export const logTabSwitch = async (req, res) => {
    try {
        const { id } = req.params; // attempt ID
        const attempt = await ExamAttempt.findById(id);

        if (!attempt) {
            return res.status(404).json({ success: false, message: 'Attempt not found' });
        }

        if (attempt.studentId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Log the tab switch
        attempt.tabSwitchLog.push({ switchedAt: new Date() });
        attempt.tabSwitchCount = (attempt.tabSwitchCount || 0) + 1;
        await attempt.save();

        res.status(200).json({
            success: true,
            tabSwitchCount: attempt.tabSwitchCount,
            message: `Warning: Tab switch ${attempt.tabSwitchCount} recorded`,
        });
    } catch (error) {
        console.error('Log tab switch error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Check if student can attempt exam (duplicate prevention)
// @route   GET /api/student/exams/:id/can-attempt
export const checkCanAttempt = async (req, res) => {
    try {
        const { id } = req.params; // exam ID
        const exam = await Exam.findById(id);

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const existingAttempts = await ExamAttempt.countDocuments({
            examId: id,
            studentId: req.user.id,
        });

        const maxAttempts = exam.maxAttempts || 1;
        const canAttempt = exam.allowRetake ? existingAttempts < maxAttempts : existingAttempts === 0;

        res.status(200).json({
            success: true,
            canAttempt,
            existingAttempts,
            maxAttempts,
            message: canAttempt ? 'You can take this exam' : 'Maximum attempts reached for this exam',
        });
    } catch (error) {
        console.error('Check can attempt error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

