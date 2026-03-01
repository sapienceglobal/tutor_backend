import { Exam } from '../models/Exam.js';
import Enrollment from '../models/Enrollment.js';
import mongoose from 'mongoose';

// @desc    Get upcoming scheduled exams for the dashboard calendar widget
// @route   GET /api/calendar/upcoming-exams
// @access  Private (Student, Tutor)
export const getUpcomingExams = async (req, res) => {
    try {
        const now = new Date();
        let query = {
            isScheduled: true,
            startDate: { $gt: now },
            status: 'published'
        };

        if (req.user.role === 'student') {
            // Find courses the student is enrolled in
            const enrollments = await Enrollment.find({ studentId: req.user.id }).select('courseId');
            const courseIds = enrollments.map(e => e.courseId);

            if (courseIds.length === 0) {
                return res.status(200).json({ success: true, count: 0, exams: [] });
            }

            // Only fetch exams for courses the student is enrolled in
            query.courseId = { $in: courseIds };
        } else if (req.user.role === 'tutor') {
            // Tutor only sees exams they created
            query.tutorId = req.user.tutorId;
        }

        // Fetch upcoming exams, sorted by closest start date
        const exams = await Exam.find(query)
            .populate('courseId', 'title thumbnail')
            .sort({ startDate: 1 })
            .limit(10); // Limit to top 10 upcoming for the widget

        res.status(200).json({
            success: true,
            count: exams.length,
            exams
        });
    } catch (error) {
        console.error('Get upcoming exams error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching upcoming exams' });
    }
};
