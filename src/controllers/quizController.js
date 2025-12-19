import QuizAttempt from '../models/QuizAttempt.js';
import Lesson from '../models/Lesson.js';
import Progress from '../models/Progress.js';
import Enrollment from '../models/Enrollment.js';

// @desc    Start Quiz Attempt (Initialize)
// @route   POST /api/quiz/start/:lessonId
export const startQuizAttempt = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const studentId = req.user.id;

        // Get lesson with quiz
        const lesson = await Lesson.findById(lessonId);
        if (!lesson || lesson.type !== 'quiz') {
            return res.status(404).json({
                success: false,
                message: 'Quiz lesson not found',
            });
        }

        const quiz = lesson.content.quiz;
        if (!quiz || !quiz.questions || quiz.questions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No questions available in this quiz',
            });
        }

        // Check enrollment
        const enrollment = await Enrollment.findOne({
            studentId,
            courseId: lesson.courseId,
            status: 'active',
        });

        if (!enrollment && !lesson.isFree) {
            return res.status(403).json({
                success: false,
                message: 'You must be enrolled to take this quiz',
            });
        }

        // Check attempt limits
        if (quiz.maxAttempts && quiz.maxAttempts > 0) {
            const previousAttempts = await QuizAttempt.countDocuments({
                studentId,
                lessonId,
            });

            if (previousAttempts >= quiz.maxAttempts) {
                return res.status(403).json({
                    success: false,
                    message: `Maximum ${quiz.maxAttempts} attempts allowed`,
                    attemptsUsed: previousAttempts,
                });
            }
        }

        // Get attempt number
        const attemptNumber = await QuizAttempt.countDocuments({
            studentId,
            lessonId,
        }) + 1;

        // Prepare questions (shuffle if needed)
        let questions = quiz.questions.map(q => ({
            _id: q._id,
            question: q.question,
            options: quiz.shuffleOptions
                ? shuffleArray([...q.options])
                : q.options,
            points: q.points || 1,
            explanation: quiz.showCorrectAnswers ? q.explanation : null,
        }));

        if (quiz.shuffleQuestions) {
            questions = shuffleArray(questions);
        }

        // Return quiz data WITHOUT correct answers
        const safeQuestions = questions.map(q => ({
            _id: q._id,
            question: q.question,
            options: q.options.map(opt => ({
                text: opt.text,
                // Don't send isCorrect flag
            })),
            points: q.points,
        }));

        res.status(200).json({
            success: true,
            quiz: {
                title: quiz.title,
                description: quiz.description,
                passingScore: quiz.passingScore,
                timeLimit: quiz.timeLimit,
                totalPoints: quiz.totalPoints,
                totalQuestions: questions.length,
                attemptNumber,
                questions: safeQuestions,
            },
        });
    } catch (error) {
        console.error('Start quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start quiz',
        });
    }
};

// @desc    Submit Quiz Attempt
// @route   POST /api/quiz/submit/:lessonId
export const submitQuizAttempt = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { answers, timeSpent } = req.body;
        const studentId = req.user.id;

        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid answers format',
            });
        }

        // Get lesson
        const lesson = await Lesson.findById(lessonId);
        if (!lesson || lesson.type !== 'quiz') {
            return res.status(404).json({
                success: false,
                message: 'Quiz lesson not found',
            });
        }

        const quiz = lesson.content.quiz;

        // Grade answers
        let pointsEarned = 0;
        let pointsPossible = 0;
        const gradedAnswers = [];

        for (const answer of answers) {
            const question = quiz.questions.find(
                q => q._id.toString() === answer.questionId,
            );

            if (!question) continue;

            const points = question.points || 1;
            pointsPossible += points;

            const correctOption = question.options.find(opt => opt.isCorrect);
            const correctIndex = question.options.indexOf(correctOption);
            const isCorrect = answer.selectedOptionIndex === correctIndex;

            if (isCorrect) {
                pointsEarned += points;
            }

            gradedAnswers.push({
                questionId: answer.questionId,
                selectedOptionIndex: answer.selectedOptionIndex,
                isCorrect,
                pointsEarned: isCorrect ? points : 0,
                timeTaken: answer.timeTaken || 0,
            });
        }

        // Calculate score percentage
        const score = pointsPossible > 0
            ? Math.round((pointsEarned / pointsPossible) * 100)
            : 0;
        const isPassed = score >= quiz.passingScore;

        // Get attempt number
        const attemptNumber = await QuizAttempt.countDocuments({
            studentId,
            lessonId,
        }) + 1;

        // Save attempt
        const attempt = await QuizAttempt.create({
            studentId,
            lessonId,
            courseId: lesson.courseId,
            quizTitle: quiz.title,
            totalQuestions: quiz.questions.length,
            totalPoints: pointsPossible,
            answers: gradedAnswers,
            score,
            pointsEarned,
            pointsPossible,
            isPassed,
            startedAt: new Date(Date.now() - (timeSpent * 1000)),
            submittedAt: new Date(),
            timeSpent,
            attemptNumber,
        });

        // Update progress if passed
        if (isPassed) {
            await Progress.findOneAndUpdate(
                {
                    studentId,
                    lessonId,
                    courseId: lesson.courseId,
                },
                {
                    completed: true,
                    completedAt: new Date(),
                    quizScore: score,
                },
                { upsert: true, new: true },
            );
        }

        // Prepare detailed results (with correct answers if allowed)
        const detailedResults = quiz.showCorrectAnswers
            ? quiz.questions.map(q => {
                const studentAnswer = gradedAnswers.find(
                    a => a.questionId === q._id.toString(),
                );
                const correctIndex = q.options.findIndex(opt => opt.isCorrect);

                return {
                    question: q.question,
                    options: q.options.map(opt => opt.text),
                    correctIndex,
                    selectedIndex: studentAnswer?.selectedOptionIndex ?? -1,
                    isCorrect: studentAnswer?.isCorrect ?? false,
                    explanation: q.explanation,
                    pointsEarned: studentAnswer?.pointsEarned ?? 0,
                    pointsPossible: q.points || 1,
                };
            })
            : null;

        res.status(200).json({
            success: true,
            message: isPassed ? 'Quiz passed!' : 'Quiz completed',
            attempt: {
                id: attempt._id,
                score,
                pointsEarned,
                pointsPossible,
                isPassed,
                attemptNumber,
                timeSpent,
            },
            detailedResults,
            allowRetake: quiz.allowRetake && !isPassed,
        });
    } catch (error) {
        console.error('Submit quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit quiz',
        });
    }
};

// @desc    Get Quiz Attempts History
// @route   GET /api/quiz/attempts/:lessonId
export const getQuizAttempts = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const studentId = req.user.id;

        const attempts = await QuizAttempt.find({
            studentId,
            lessonId,
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            attempts,
        });
    } catch (error) {
        console.error('Get attempts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get attempts',
        });
    }
};

// @desc    Get Single Attempt Details
// @route   GET /api/quiz/attempt/:attemptId
export const getAttemptDetails = async (req, res) => {
    try {
        const { attemptId } = req.params;
        const studentId = req.user.id;
        console.log("AttemptId : ", attemptId);
        const attempt = await QuizAttempt.findOne({
            _id: attemptId,
            studentId,
        }).populate('lessonId');

        if (!attempt) {
            return res.status(404).json({
                success: false,
                message: 'Attempt not found',
            });
        }

        const lesson = attempt.lessonId;
        const quiz = lesson.content.quiz;

        // Build detailed results with questions
        const detailedResults = quiz.questions.map(q => {
            const studentAnswer = attempt.answers.find(
                a => a.questionId === q._id.toString(),
            );
            const correctIndex = q.options.findIndex(opt => opt.isCorrect);

            return {
                question: q.question,
                options: q.options.map(opt => opt.text),
                correctIndex,
                selectedIndex: studentAnswer?.selectedOptionIndex ?? -1,
                isCorrect: studentAnswer?.isCorrect ?? false,
                explanation: q.explanation,
                pointsEarned: studentAnswer?.pointsEarned ?? 0,
                pointsPossible: q.points || 1,
            };
        });

        res.status(200).json({
            success: true,
            attempt,
            detailedResults,
        });
    } catch (error) {
        console.error('Get attempt details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get attempt details',
        });
    }
};

// ==================== HELPER FUNCTIONS ====================

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}