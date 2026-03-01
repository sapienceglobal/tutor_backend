import { Exam, ExamAttempt } from '../models/Exam.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import mongoose from 'mongoose';

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

        // Get student's attempts to show status
        const myAttempts = await ExamAttempt.find({ studentId });

        const processedExams = exams.map(exam => {
            if (!exam.courseId) return null; // Skip if course deleted

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
        const { answers, timeSpent } = req.body;
        const studentId = req.user.id;

        const exam = await Exam.findById(id);
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

        let score = 0;
        let correctCount = 0;

        const processedAnswers = answers.map(ans => {
            const question = exam.questions.id(ans.questionId);
            if (!question) return null;

            // Find selected option text
            // Note: Frontend should send selectedOption index or ID. 
            // Assuming index for now to match hackathon style simple UI, or ID if robust.
            // Let's stick to existing logic pattern: expecting `selectedOption` (index) or `selectedOptionId`.

            // Adaptation for "Hackathon UI" which usually sends index 0-3
            const selectedOptIndex = ans.selectedOption;
            const isCorrect = question.options[selectedOptIndex]?.isCorrect || false;

            if (isCorrect) {
                score += question.points || 1;
                correctCount++;
            } else if (exam.negativeMarking && selectedOptIndex !== -1 && selectedOptIndex !== null) {
                score -= (question.points || 1) * 0.25;
            }

            return {
                questionId: question._id,
                selectedOption: selectedOptIndex,
                isCorrect,
                pointsEarned: isCorrect ? (question.points || 1) : 0
            };
        }).filter(Boolean);

        score = Math.max(0, score);
        const percentage = (score / exam.totalMarks) * 100;
        const isPassed = percentage >= (exam.passingPercentage || 33);

        const attempt = await ExamAttempt.create({
            examId: id,
            studentId,
            courseId: exam.courseId,
            attemptNumber: 1,
            answers: processedAnswers,
            score,
            percentage,
            isPassed,
            timeSpent,
            startedAt: new Date(),
            submittedAt: new Date()
        });

        // --- Compute Percentile ---
        const allAttempts = await ExamAttempt.find({ examId: id });
        const allScores = allAttempts.map(a => a.score).sort((a, b) => a - b);
        const rank = allScores.filter(s => s < score).length;
        const percentile = Math.round((rank / allScores.length) * 100);
        attempt.percentile = percentile;
        await attempt.save();

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
            .populate('examId', 'title totalMarks passingPercentage duration totalQuestions questions');

        if (!attempt) {
            return res.status(404).json({ success: false, message: 'Result not found' });
        }

        // Create a map of answers for easy lookup
        const answerMap = {};
        attempt.answers.forEach(ans => {
            answerMap[ans.questionId.toString()] = ans;
        });

        // Enhance questions with attempt data
        // We need to fetch the exam with questions populated if not already (ExamAttempt populate usually doesn't deep populate questions unless specified in schema, 
        // but typically questions are embedded in Exam. Let's assume Exam has questions embedded).
        // Actually, ExamAttempt has `answers` which has `questionId`. 
        // We need the ACTUAL question text and options from the Exam model.
        // The `populate('examId')` above fetches the Exam document. 

        const detailedAnalysis = attempt.examId.questions.map(q => {
            const studentAns = answerMap[q._id.toString()];
            return {
                _id: q._id,
                question: q.question,
                options: q.options,
                points: q.points,
                userSelectedOption: studentAns ? studentAns.selectedOption : -1,
                isCorrect: studentAns ? studentAns.isCorrect : false,
                correctOption: q.options.findIndex(opt => opt.isCorrect) // Result page CAN show correct answer
            };
        });

        res.status(200).json({
            success: true,
            attempt: {
                _id: attempt._id,
                examTitle: attempt.examId.title,
                totalMarks: attempt.examId.totalMarks,
                passingPercentage: attempt.examId.passingPercentage,
                score: attempt.score,
                percentage: attempt.percentage,
                isPassed: attempt.isPassed,
                timeSpent: attempt.timeSpent,
                submittedAt: attempt.submittedAt,
                percentile: attempt.percentile,
                totalQuestions: attempt.examId.totalQuestions,
                correctCount: attempt.answers.filter(a => a.isCorrect).length,
                incorrectCount: attempt.answers.filter(a => !a.isCorrect && a.selectedOption !== -1).length,
                unansweredCount: attempt.answers.filter(a => a.selectedOption === -1).length,
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

