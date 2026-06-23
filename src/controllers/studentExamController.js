import { Exam, ExamAttempt } from '../models/Exam.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Batch from '../models/Batch.js';
import mongoose from 'mongoose';
import {
    buildAttemptQuestionResults,
    evaluatePass,
} from '../utils/examScoring.js';
import { featureFlags } from '../config/featureFlags.js';
import { getForUser as getEntitlementsForUser } from '../services/entitlementService.js';
import { evaluateAccess } from '../services/accessPolicy.js';
import { emitLearningEvent } from '../services/learningEventService.js';
import { evaluateSubjectiveAnswer } from './aiController.js';

const isStudentInExamBatch = async (exam, studentId, enrollment = null) => {
    if (!exam.batchId) return true;
    if (enrollment?.batchId?.toString() === exam.batchId.toString()) return true;
    return Boolean(await Batch.exists({ _id: exam.batchId, students: studentId }));
};

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
                select: 'title courseId totalQuestions duration showResultImmediately',
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
        const formattedAttempts = filteredAttempts.map(attempt => {
            const showResult = attempt.examId?.showResultImmediately !== false;
            return {
                _id: attempt._id,
                examId: attempt.examId._id,
                examTitle: attempt.examId.title,
                courseTitle: attempt.examId.courseId?.title || 'Unknown Course',
                score: showResult ? attempt.score : null,
                totalMarks: attempt.totalMarks || attempt.examId?.totalQuestions || 0,
                submittedAt: attempt.submittedAt,
                date: attempt.submittedAt,
                isPassed: showResult ? attempt.isPassed : null,
                status: showResult ? 'Published' : 'Pending'
            };
        });

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
        const query = { status: 'published' };
        if (req.query.search) {
            query.title = { $regex: req.query.search, $options: 'i' };
        }
        const exams = await Exam.find(query)
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
                courseId: exam.courseId?._id,
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
// @desc    Get Single Exam for Taking Loop (Student Portal)
// @route   GET /api/student/exams/:id
export const getExamById = async (req, res) => {
    try {
        const { id } = req.params;// Ensure Exam is imported
        const exam = await Exam.findById(id).lean();

        if (!exam || exam.status !== 'published') {
            return res.status(404).json({ success: false, message: 'Exam not found or not available' });
        }

        let enrollment = null;
        if (exam.courseId && (!exam.isFree || exam.batchId)) {
            enrollment = await Enrollment.findOne({
                studentId: req.user.id,
                courseId: exam.courseId,
                status: 'active',
            });

            if (!exam.isFree && !enrollment) {
                return res.status(403).json({ success: false, message: 'You must be enrolled in the course to take this exam' });
            }

            if (exam.batchId && !(await isStudentInExamBatch(exam, req.user.id, enrollment))) {
                return res.status(403).json({ success: false, message: 'This exam is not available for your batch' });
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

        // Enforce maximum attempts limit
        const attemptCount = await ExamAttempt.countDocuments({ examId: id, studentId: req.user.id });
        const maxAttempts = exam.maxAttempts || 1;
        const canAttempt = exam.allowRetake ? attemptCount < maxAttempts : attemptCount === 0;

        if (!canAttempt) {
            return res.status(403).json({ success: false, message: 'You have reached the maximum attempt limit for this exam' });
        }

        // Helper function for shuffling arrays
        const shuffleArray = (array) => {
            const newArr = [...array];
            for (let i = newArr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
            }
            return newArr;
        };

        // Security: Remove correct answers AND apply shuffling if enabled by tutor
        let secureQuestions = exam.questions.map(q => {
            // Shuffle options if enabled
            let safeOptions = q.options.map(opt => ({
                _id: opt._id,
                text: opt.text
            }));

            if (exam.shuffleOptions) {
                safeOptions = shuffleArray(safeOptions);
            }

            return {
                _id: q._id,
                question: q.question,
                options: safeOptions,
                points: q.points,
                type: q.questionType || q.type, // Ensure type is passed correctly
                passage: q.passage,             // Important for passage type
                pairs: q.pairs ? q.pairs.map(p => ({ left: p.left, right: p.right })) : [] // For match type
            };
        });

        // Shuffle questions if enabled
        if (exam.shuffleQuestions && !exam.sections?.length) {
            // Don't shuffle if sections exist, as it breaks section index bounds
            secureQuestions = shuffleArray(secureQuestions);
        }

        res.status(200).json({
            success: true,
            exam: {
                _id: exam._id,
                title: exam.title,
                duration: exam.duration,
                instructions: exam.instructions || exam.description,
                questions: secureQuestions,
                totalMarks: exam.totalMarks,
                sections: exam.sections || [],
                isAdaptive: exam.isAdaptive || false,
                isProctoringEnabled: exam.isProctoringEnabled || false,
                isAudioProctoringEnabled: exam.isAudioProctoringEnabled || false,
                strictTabSwitching: exam.strictTabSwitching || false,
                negativeMarking: exam.negativeMarking || false,
                maxAttempts: exam.maxAttempts || 1,
                showResultImmediately: exam.showResultImmediately // Frontend ke liye useful h
            }
        });

    } catch (error) {
        console.error('Get exam error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Submit Exam (Student Portal)
// @route   POST /api/student/exams/:id/submit
// ================================================================
// REPLACE the existing submitExam function in studentExamController.js
// with this version — it saves tabSwitchCount, proctoringEvents,
// aiRiskScore and aiRiskLevel into the ExamAttempt document.
// ================================================================

// @desc    Submit Exam (Student Portal)
// @route   POST /api/student/exams/:id/submit
export const submitExam = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            answers,
            timeSpent,
            startedAt,
            // ── Proctoring data from frontend ──────────────────────
            tabSwitchCount = 0,
            proctoringEvents = [],
        } = req.body;
        const studentId = req.user.id;

        const exam = await Exam.findById(id);
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

        let enrollment = null;
        if (!exam.isFree || exam.batchId) {
            enrollment = await Enrollment.findOne({
                studentId,
                courseId: exam.courseId,
                status: 'active',
            });
            if (!exam.isFree && !enrollment) {
                return res.status(403).json({ success: false, message: 'You must be enrolled in the course to take this exam' });
            }
            if (exam.batchId && !(await isStudentInExamBatch(exam, studentId, enrollment))) {
                return res.status(403).json({ success: false, message: 'This exam is not available for your batch' });
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
                return res.status(403).json({ success: false, message: 'Exam is not available in your current audience scope' });
            }
        }

        // ── Grade answers ─────────────────────────────────────────
        let score = 0;
        const attemptCount = await ExamAttempt.countDocuments({ examId: id, studentId });

        if (!exam.allowRetake && attemptCount > 0) {
            return res.status(403).json({ success: false, message: 'You have already taken this exam' });
        }
        const maxAttempts = exam.maxAttempts || 1;
        if (attemptCount >= maxAttempts) {
            return res.status(403).json({ success: false, message: 'Maximum attempt limit reached for this exam' });
        }

        const processedAnswers = (await Promise.all(answers.map(async ans => {
            const question = exam.questions.id(ans.questionId);
            if (!question) {
                return null;
            }

            let isCorrect = false;
            let pointsEarned = 0;
            let scoreDelta = 0;
            const qType = question.questionType || 'mcq';

            if (qType === 'subjective') {
                const textAnswer = ans.textAnswer || ans.selectedOptionText || '';
                const maxPoints = question.points || 1;
                const evaluation = await evaluateSubjectiveAnswer(
                    question.question,
                    question.idealAnswer,
                    textAnswer,
                    maxPoints
                );
                isCorrect = evaluation.isCorrect;
                pointsEarned = evaluation.pointsEarned;
                scoreDelta = evaluation.pointsEarned;

                return {
                    questionId: question._id,
                    selectedOption: -1,
                    selectedOptionText: null,
                    textAnswer,
                    aiFeedback: evaluation.feedback,
                    aiHighlights: evaluation.highlights || [],
                    isCorrect,
                    pointsEarned,
                    timeTaken: Number(ans.timeTaken) || 0,
                    _scoreDelta: scoreDelta,
                    questionData: {
                        question: question.question,
                        options: [],
                        correctOption: -1,
                        explanation: question.explanation || null,
                        points: question.points,
                        difficulty: question.difficulty,
                        questionType: qType,
                        numericAnswer: null,
                        tolerance: 0,
                        pairs: []
                    }
                };
            }

            if (qType === 'mcq' || qType === 'passage_based') {
                if (typeof ans.selectedOptionText === 'string' && ans.selectedOptionText.trim()) {
                    const optionByText = question.options.find(opt => opt.text === ans.selectedOptionText.trim());
                    if (optionByText) {
                        isCorrect = optionByText.isCorrect || false;
                    }
                } else if (ans.selectedOption !== -1 && ans.selectedOption !== null && ans.selectedOption !== undefined) {
                    isCorrect = question.options[ans.selectedOption]?.isCorrect || false;
                }

                if (isCorrect) {
                    pointsEarned = question.points || 1;
                    scoreDelta = pointsEarned;
                } else if (ans.selectedOption !== -1 && ans.selectedOption !== null && ans.selectedOption !== undefined && exam.negativeMarking) {
                    pointsEarned = 0;
                    scoreDelta = -0.25 * (question.points || 1);
                }
            } else if (qType === 'numeric') {
                const rawAns = (ans.numericAnswer !== undefined && ans.numericAnswer !== null && ans.numericAnswer !== '')
                    ? ans.numericAnswer
                    : ans.textAnswer;
                if (rawAns !== undefined && rawAns !== null && rawAns !== '' && question.numericAnswer !== undefined && question.numericAnswer !== null) {
                    const studentAns = Number(rawAns);
                    const correctAns = Number(question.numericAnswer);
                    const tolerance = Number(question.tolerance || 0);

                    if (!isNaN(studentAns) && Math.abs(studentAns - correctAns) <= tolerance) {
                        isCorrect = true;
                        pointsEarned = question.points || 1;
                        scoreDelta = pointsEarned;
                    } else if (exam.negativeMarking) {
                        pointsEarned = 0;
                        scoreDelta = -0.25 * (question.points || 1);
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
                        scoreDelta = pointsEarned;
                    } else if (correctMatches > 0) {
                        pointsEarned = parseFloat(((correctMatches / totalPairs) * (question.points || 1)).toFixed(2));
                        scoreDelta = pointsEarned;
                    } else if (exam.negativeMarking && Object.keys(ans.matchAnswers).length > 0) {
                        pointsEarned = 0;
                        scoreDelta = -0.25 * (question.points || 1);
                    }
                }
            }

            const correctOptionIndex = (qType === 'mcq' || qType === 'passage_based') ? question.options.findIndex(opt => opt.isCorrect) : -1;
            const selectedOptIndex = Number.isInteger(ans.selectedOption) ? ans.selectedOption : -1;
            const selectedOptionText = (typeof ans.selectedOptionText === 'string' && ans.selectedOptionText.trim())
                ? ans.selectedOptionText.trim()
                : (selectedOptIndex >= 0 ? question.options[selectedOptIndex]?.text || null : null);

            return {
                questionId: question._id,
                selectedOption: selectedOptIndex,
                selectedOptionText,
                numericAnswer: ans.numericAnswer,
                matchAnswers: ans.matchAnswers,
                textAnswer: ans.textAnswer || null,
                isCorrect,
                pointsEarned,
                timeTaken: Number(ans.timeTaken) || 0,
                _scoreDelta: scoreDelta,
                questionData: {
                    question: question.question,
                    options: question.options ? question.options.map(opt => ({ text: opt.text })) : [],
                    correctOption: correctOptionIndex,
                    explanation: question.explanation || null,
                    points: question.points,
                    difficulty: question.difficulty,
                    questionType: qType,
                    numericAnswer: question.numericAnswer,
                    tolerance: question.tolerance,
                    pairs: question.pairs
                }
            };
        }))).filter(Boolean);

        score = processedAnswers.reduce((total, ans) => total + (ans._scoreDelta || 0), 0);
        score = Math.max(0, score);

        const passEvaluation = evaluatePass({
            score,
            totalMarks: exam.totalMarks,
            passingPercentage: exam.passingPercentage,
            passingMarks: exam.passingMarks,
        });
        const percentage = passEvaluation.displayPercentage;
        const isPassed = passEvaluation.isPassed;

        // ── Compute AI risk score from proctoring data ────────────
        const safeTabCount = Math.max(0, Number(tabSwitchCount) || 0);
        const safeEvents = Array.isArray(proctoringEvents) ? proctoringEvents : [];

        const highEvents = safeEvents.filter(e => e.severity === 'high' || e.severity === 'critical').length;
        const mediumEvents = safeEvents.filter(e => e.severity === 'medium').length;

        // Risk score 0–10
        let aiRiskScore = 0;
        aiRiskScore += Math.min(safeTabCount * 0.8, 3);   // tab switches — max 3 pts
        aiRiskScore += Math.min(highEvents * 1.5, 4);   // high severity — max 4 pts
        aiRiskScore += Math.min(mediumEvents * 0.8, 2);   // medium severity — max 2 pts
        aiRiskScore += Math.min(safeEvents.length * 0.1, 1); // raw event count — max 1 pt
        aiRiskScore = Math.min(10, Math.round(aiRiskScore * 10) / 10);

        // Risk level
        let aiRiskLevel;
        if (aiRiskScore >= 6.5) aiRiskLevel = 'Cheating Detected';
        else if (aiRiskScore >= 3.5) aiRiskLevel = 'Suspicious Detected';
        else if (aiRiskScore >= 1.0) aiRiskLevel = 'Low Confidence Detected';
        else aiRiskLevel = 'Safe';

        // Build tabSwitchLog from events
        const tabSwitchLog = safeEvents
            .filter(e => e.eventType === 'tab_switch')
            .map(e => ({ switchedAt: new Date(e.timestamp || Date.now()), count: 1 }));

        // ── Sanitize proctoringEvents for DB enum ─────────────────
        const allowedEventTypes = ['tab_switch', 'unauthorized_object', 'multiple_faces', 'no_face', 'audio_anomaly'];
        const allowedSeverities = ['low', 'medium', 'high'];

        const sanitizedEvents = safeEvents
            .filter(e => allowedEventTypes.includes(e.eventType))
            .map(e => ({
                eventType: e.eventType,
                timestamp: new Date(e.timestamp || Date.now()),
                severity: allowedSeverities.includes(e.severity) ? e.severity : 'medium',
                details: typeof e.details === 'string' ? e.details.slice(0, 500) : '',
                videoTimestamp: typeof e.videoTimestamp === 'number' ? e.videoTimestamp : 0,
            }));

        // ── Create attempt ────────────────────────────────────────
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
            submittedAt: new Date(),

            // ── Proctoring fields ─────────────────────────────────
            tabSwitchCount: safeTabCount,
            tabSwitchLog,
            proctoringEvents: sanitizedEvents,
            aiRiskScore,
            aiRiskLevel,
        });

        // ── Compute percentile ────────────────────────────────────
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
            meta: { score, percentage, isPassed, attemptNumber: attempt.attemptNumber },
        });

        res.status(200).json({
            success: true,
            score,
            isPassed,
            percentage,
            percentile,
            attemptId: attempt._id,
            // Return proctoring summary so frontend can show warning if needed
            proctoring: {
                riskLevel: aiRiskLevel,
                riskScore: aiRiskScore,
                tabSwitches: safeTabCount,
                totalEvents: sanitizedEvents.length,
            },
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
            .populate('examId', 'title totalMarks passingPercentage passingMarks duration totalQuestions questions showCorrectAnswers hideSolutions showResultImmediately');

        if (!attempt) {
            return res.status(404).json({ success: false, message: 'Result not found' });
        }

        if (attempt.examId.showResultImmediately === false) {
            return res.status(403).json({ success: false, message: 'Results are hidden by the tutor and will be published later.' });
        }

        const rawAnalysis = buildAttemptQuestionResults({
            exam: attempt.examId,
            attempt,
        });

        const detailedAnalysis = rawAnalysis.map((item) => ({
            _id: item.questionId,
            questionNumber: item.questionNumber,
            question: item.question,
            questionType: item.questionType, // ✅ Return questionType for frontend rendering
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
            aiFeedback: item.aiFeedback,
            aiHighlights: item.aiHighlights,
            timeTaken: item.timeTaken,
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
                duration: attempt.examId.duration,
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
        // Emit real-time proctoring warning to Tutor via WebSocket
        setImmediate(async () => {
            try {
                const exam = await Exam.findById(attempt.examId).populate({
                    path: 'courseId',
                    populate: { path: 'tutorId' }
                });
                if (exam && exam.courseId && exam.courseId.tutorId) {
                    const tutorUserId = exam.courseId.tutorId.userId;
                    if (tutorUserId) {
                        const { emitProctoringAlert } = await import('../../services/socketService.js');
                        emitProctoringAlert(tutorUserId.toString(), {
                            attemptId: attempt._id,
                            studentName: req.user.name,
                            examTitle: exam.title,
                            tabSwitchCount: attempt.tabSwitchCount,
                            eventType: 'tab_switch',
                            timestamp: new Date()
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to emit real-time proctoring socket warning:', err);
            }
        });
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

        let enrollment = null;
        if (exam.courseId && (!exam.isFree || exam.batchId)) {
            enrollment = await Enrollment.findOne({
                studentId: req.user.id,
                courseId: exam.courseId,
                status: 'active',
            });
            if (!exam.isFree && !enrollment) {
                return res.status(403).json({ success: false, canAttempt: false, message: 'You must be enrolled in the course to take this exam' });
            }
            if (exam.batchId && !(await isStudentInExamBatch(exam, req.user.id, enrollment))) {
                return res.status(403).json({ success: false, canAttempt: false, message: 'This exam is not available for your batch' });
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
                return res.status(403).json({ success: false, canAttempt: false, message: 'Exam is not available in your current audience scope' });
            }
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

// @desc    Get Exam Leaderboard
// @route   GET /api/student/exams/:id/leaderboard
export const getExamLeaderboard = async (req, res) => {
    try {
        const examId = req.params.id;
        const currentStudentId = req.user.id;

        // 1. Check if the current student has attempted this exam.
        const currentStudentAttemptExists = await ExamAttempt.exists({
            examId,
            studentId: currentStudentId
        });

        if (!currentStudentAttemptExists) {
            return res.status(403).json({
                success: false,
                message: 'You must attempt the exam before viewing the leaderboard.'
            });
        }

        // 2. Fetch all attempts for this exam
        const attempts = await ExamAttempt.find({ examId })
            .populate('studentId', 'name email profileImage')
            .select('studentId score percentage timeSpent submittedAt')
            .lean();

        // 3. For each unique student, keep only their best attempt (highest score).
        // If there's a tie in score, the tie-breaker is timeSpent (lower is better).
        const studentBestAttempts = {};

        attempts.forEach(attempt => {
            if (!attempt.studentId) return; // skip if student deleted
            const studentIdStr = attempt.studentId._id.toString();
            const existing = studentBestAttempts[studentIdStr];

            if (!existing) {
                studentBestAttempts[studentIdStr] = attempt;
            } else {
                // Compare attempts
                const isBetter = 
                    attempt.score > existing.score || 
                    (attempt.score === existing.score && (attempt.timeSpent || 0) < (existing.timeSpent || 0));
                if (isBetter) {
                    studentBestAttempts[studentIdStr] = attempt;
                }
            }
        });

        // 4. Sort the best attempts: highest score desc, lowest timeSpent asc
        const sortedBestAttempts = Object.values(studentBestAttempts).sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return (a.timeSpent || 0) - (b.timeSpent || 0);
        });

        // 5. Assign competition ranks: identical score and timeSpent get the same rank
        let displayedRank = 1;
        const rankedLeaderboard = sortedBestAttempts.map((attempt, index) => {
            if (index > 0) {
                const prev = sortedBestAttempts[index - 1];
                if (attempt.score !== prev.score || attempt.timeSpent !== prev.timeSpent) {
                    displayedRank = index + 1;
                }
            }
            
            const isCurrentUser = attempt.studentId._id.toString() === currentStudentId;
            return {
                student: {
                    _id: attempt.studentId._id,
                    name: attempt.studentId.name,
                    email: attempt.studentId.email,
                    profileImage: attempt.studentId.profileImage
                },
                score: attempt.score,
                percentage: attempt.percentage,
                timeSpent: attempt.timeSpent,
                submittedAt: attempt.submittedAt,
                rank: displayedRank,
                isCurrentUser
            };
        });

        // 6. Find current student's entry and rank
        const currentStudentRankEntry = rankedLeaderboard.find(entry => entry.isCurrentUser);
        const currentStudentRank = currentStudentRankEntry ? currentStudentRankEntry.rank : null;
        const totalParticipants = rankedLeaderboard.length;

        // 7. Limit to top 50
        let displayList = rankedLeaderboard.slice(0, 50);

        // 8. If the current student is not in the top 50, append them to the display list
        if (currentStudentRankEntry && !displayList.some(entry => entry.isCurrentUser)) {
            displayList.push(currentStudentRankEntry);
        }

        res.status(200).json({
            success: true,
            leaderboard: displayList,
            currentStudentRank,
            totalParticipants
        });

    } catch (error) {
        console.error('Get exam leaderboard error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

