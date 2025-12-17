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

        let enrollment = null;
        if (!isOwner) {
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

        // Hide correct answers for students until after submission
        let examData = exam.toObject();
        if (!isOwner && !exam.showCorrectAnswers) {
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
        } = req.body;

        if (!courseId || !title || !duration || questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Course ID, title, duration, and questions are required',
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
        const cleanedQuestions = questions.map(q => {
            const { _id, ...questionWithoutId } = q;
            return questionWithoutId;
        });

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
            allowRetake: allowRetake || false,
            maxAttempts: maxAttempts || 1,
            startDate,
            endDate,
            isScheduled: !!(startDate && endDate),
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
            'showResultImmediately', 'showCorrectAnswers', 'allowRetake',
            'maxAttempts', 'startDate', 'endDate', 'isScheduled', 'status', 'isPublished',
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

        // Check enrollment
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

            const isCorrect = question.options[ans.selectedOption]?.isCorrect || false;
            const pointsEarned = isCorrect ? (question.points || 1) : 0;
            score += pointsEarned;

            // Find correct option index
            const correctOptionIndex = question.options.findIndex(opt => opt.isCorrect);

            return {
                questionId: ans.questionId,
                selectedOption: ans.selectedOption,
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

        const percentage = Math.round((score / exam.totalMarks) * 100);
        const isPassed = score >= exam.passingMarks;

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