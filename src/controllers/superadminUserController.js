import User from '../models/User.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import { ExamAttempt } from '../models/Exam.js';
import QuizAttempt from '../models/QuizAttempt.js';
import Batch from '../models/Batch.js';

// @desc    Get complete 360-degree profile of any user
// @route   GET /api/superadmin/users/:id/profile
// @access  Private/Superadmin
export const getUserProfile = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch basic user details
        const user = await User.findById(id).select('-password').populate('instituteId', 'name subdomain');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        let profileData = {
            user,
            stats: {},
            recentActivity: []
        };

        // ─── IF USER IS A STUDENT ───
        if (user.role === 'student') {
            // Get Enrollments
            const enrollments = await Enrollment.find({ studentId: id })
                .populate('courseId', 'title thumbnail')
                .populate('batchId', 'name');
            
            // Get Exam Stats (Using your advanced ExamAttempt model)
            const examAttempts = await ExamAttempt.find({ studentId: id })
                .populate('examId', 'title')
                .sort({ createdAt: -1 });

            const totalExams = examAttempts.length;
            const passedExams = examAttempts.filter(e => e.isPassed).length;
            const avgScore = totalExams > 0 
                ? (examAttempts.reduce((acc, curr) => acc + curr.percentage, 0) / totalExams).toFixed(1) 
                : 0;

            // Flag high risk cheating attempts
            const suspiciousAttempts = examAttempts.filter(e => e.aiRiskLevel === 'Suspicious Detected' || e.aiRiskLevel === 'Cheating Detected' || e.tabSwitchCount > 3);

            // Get Quiz Stats
            const quizAttempts = await QuizAttempt.countDocuments({ studentId: id });

            profileData.stats = {
                activeEnrollments: enrollments.filter(e => e.status === 'active').length,
                completedCourses: enrollments.filter(e => e.status === 'completed').length,
                totalExams,
                passedExams,
                avgScore,
                quizAttempts,
                cheatingFlags: suspiciousAttempts.length
            };

            profileData.recentActivity = {
                enrollments,
                exams: examAttempts.slice(0, 5) // Send latest 5 for the UI timeline
            };
        } 
        
       // ─── IF USER IS A TUTOR ───
        else if (user.role === 'tutor') {
            // ✅ FIX: Find the internal Tutor document ID first using the incoming User ID
            const tutorDoc = await Tutor.findOne({ userId: id });
            
            let courses = [];
            let batches = [];
            
            if (tutorDoc) {
                // Now query using the actual Tutor model _id
                courses = await Course.find({ tutorId: tutorDoc._id });
                batches = await Batch.find({ tutorId: tutorDoc._id }).populate('courseId', 'title');
            }

            // Total students taught (Sum of enrolledCount across their courses)
            const totalStudentsTaught = courses.reduce((acc, curr) => acc + (curr.enrolledCount || 0), 0);
            
            // Average rating
            const ratedCourses = courses.filter(c => c.rating > 0);
            const avgRating = ratedCourses.length > 0 
                ? (ratedCourses.reduce((acc, curr) => acc + curr.rating, 0) / ratedCourses.length).toFixed(1) 
                : 0;

            profileData.stats = {
                totalCourses: courses.length,
                activeBatches: batches.filter(b => b.status === 'active').length,
                totalStudentsTaught,
                avgRating
            };

            profileData.recentActivity = {
                courses: courses.slice(0, 5),
                batches: batches.slice(0, 5)
            };
        }// ─── IF USER IS AN ADMIN (Institute Owner) ───
        else if (user.role === 'admin') {
            const instId = user.instituteId?._id || user.instituteId;

            if (instId) {
                // Count platform metrics for this specific institute
                const totalStudents = await User.countDocuments({ instituteId: instId, role: 'student' });
                const totalTutors = await User.countDocuments({ instituteId: instId, role: 'tutor' });
                const totalCourses = await Course.countDocuments({ instituteId: instId });
                const totalBatches = await Batch.countDocuments({ instituteId: instId });

                // Fetch recent entities for timeline
                const recentCourses = await Course.find({ instituteId: instId }).sort({ createdAt: -1 }).limit(5);
                const recentTutors = await User.find({ instituteId: instId, role: 'tutor' }).select('name email profileImage createdAt').sort({ createdAt: -1 }).limit(5);

                profileData.stats = {
                    totalStudents,
                    totalTutors,
                    totalCourses,
                    totalBatches
                };

                profileData.recentActivity = {
                    courses: recentCourses,
                    tutors: recentTutors
                };
            } else {
                // Fallback if admin is somehow not linked to an institute
                profileData.stats = { totalStudents: 0, totalTutors: 0, totalCourses: 0, totalBatches: 0 };
                profileData.recentActivity = { courses: [], tutors: [] };
            }
        }

        res.status(200).json({
            success: true,
            data: profileData
        });

    } catch (error) {
        console.error('Superadmin Fetch User Profile Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user profile' });
    }
};

// @desc    Block or Unblock a User
// @route   PATCH /api/superadmin/users/:id/status
// @access  Private/Superadmin
export const toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role === 'superadmin') return res.status(403).json({ success: false, message: 'Cannot block a superadmin' });

        user.isBlocked = !user.isBlocked;
        await user.save();

        res.status(200).json({
            success: true,
            message: `User successfully ${user.isBlocked ? 'blocked' : 'unblocked'}`,
            isBlocked: user.isBlocked
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update user status' });
    }
};