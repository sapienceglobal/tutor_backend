import Report from '../models/Report.js';

export const createReport = async (req, res) => {
    try {
        const { targetType, targetId, reason, description } = req.body;

        const report = new Report({
            reporter: req.user.id, // Assumes auth middleware
            targetType,
            targetId,
            reason,
            description
        });

        await report.save();

        res.status(201).json({
            success: true,
            message: 'Report submitted successfully. We will review it shortly.',
            data: report
        });
    } catch (error) {
        console.error('Create Report Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit report'
        });
    }
};

// ─── STUDENT REPORT DATA ENDPOINTS ───────────────────────────────────────────
// These aggregate data from multiple models and return structured JSON
// The frontend converts this to PDF/CSV using browser APIs

import { ExamAttempt } from '../models/Exam.js';
import Enrollment  from '../models/Enrollment.js';
import Submission  from '../models/Submission.js';
import Assignment  from '../models/Assignment.js';
import Course      from '../models/Course.js';

// @desc    Get full student report data (exam + assignment + enrollment summary)
// @route   GET /api/reports/student/summary
// @access  Private (Student)
export const getStudentSummaryReport = async (req, res) => {
    try {
        const studentId  = req.user._id;
        const instituteId = req.tenant?._id || null;

        // Exam attempts
        const attemptQuery = { studentId };
        if (instituteId) attemptQuery.$or = [{ instituteId }, { instituteId: null }];
        const attempts = await ExamAttempt.find(attemptQuery)
            .populate('examId', 'title duration totalMarks courseId')
            .sort({ createdAt: -1 })
            .lean();

        // Enrollments + courses
        const enrollments = await Enrollment.find({ studentId, status: 'active' })
            .populate('courseId', 'title category')
            .lean();

        // Submissions (assignment)
        const submissions = await Submission.find({ studentId })
            .populate('assignmentId', 'title totalMarks dueDate')
            .sort({ submittedAt: -1 })
            .lean();

        // Computed stats
        const totalAttempts = attempts.length;
        const passedAttempts = attempts.filter(a => a.isPassed).length;
        const avgScore = totalAttempts > 0
            ? Math.round(attempts.reduce((s, a) => s + (a.totalMarks > 0 ? (a.score / a.totalMarks) * 100 : 0), 0) / totalAttempts)
            : 0;

        const gradedSubmissions = submissions.filter(s => s.status === 'graded');
        const avgAssignmentScore = gradedSubmissions.length > 0
            ? Math.round(gradedSubmissions.reduce((s, sub) => s + (sub.assignmentId?.totalMarks > 0 ? (sub.grade / sub.assignmentId.totalMarks) * 100 : 0), 0) / gradedSubmissions.length)
            : null;

        res.json({
            success: true,
            generatedAt: new Date(),
            student: { name: req.user.name, email: req.user.email, id: req.user._id },
            summary: {
                totalCourses: enrollments.length,
                totalExams: totalAttempts,
                passedExams: passedAttempts,
                failedExams: totalAttempts - passedAttempts,
                passRate: totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0,
                avgScore,
                totalAssignments: submissions.length,
                gradedAssignments: gradedSubmissions.length,
                avgAssignmentScore,
            },
            enrollments: enrollments.map(e => ({
                courseId: e.courseId?._id,
                title: e.courseId?.title || 'Course',
                category: e.courseId?.category,
                enrolledAt: e.createdAt,
                status: e.status,
            })),
            examAttempts: attempts.map(a => ({
                attemptId: a._id,
                examTitle: a.examId?.title || a.examTitle || 'Exam',
                score: a.score,
                totalMarks: a.totalMarks,
                pct: a.totalMarks > 0 ? Math.round((a.score / a.totalMarks) * 100) : 0,
                isPassed: a.isPassed,
                date: a.createdAt || a.submittedAt,
                duration: a.examId?.duration,
            })),
            assignments: submissions.map(s => ({
                submissionId: s._id,
                title: s.assignmentId?.title || 'Assignment',
                status: s.status,
                grade: s.grade,
                totalMarks: s.assignmentId?.totalMarks,
                pct: (s.status === 'graded' && s.assignmentId?.totalMarks > 0)
                    ? Math.round((s.grade / s.assignmentId.totalMarks) * 100) : null,
                submittedAt: s.submittedAt,
                gradedAt: s.gradedAt,
                feedback: s.feedback,
            })),
        });
    } catch (error) {
        console.error('getStudentSummaryReport:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
