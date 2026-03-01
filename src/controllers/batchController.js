import Batch from '../models/Batch.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// @desc    Create a new batch
// @route   POST /api/batches
// @access  Private (Admin or Tutor)
export const createBatch = async (req, res) => {
    try {
        const { name, courseId, scheduleDescription, startDate, endDate, students } = req.body;

        // If a tutor creates it, fix the tutorId to them. If admin, check if tutorId is passed (for now, assume creator is instructor)
        const tutorId = req.user.role === 'tutor' ? req.user.tutorId : req.body.tutorId;

        if (!name || !courseId || !startDate || !tutorId) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields (name, courseId, startDate, tutorId)' });
        }

        const batch = await Batch.create({
            name,
            courseId,
            tutorId,
            instituteId: req.tenant?._id || null,
            scheduleDescription,
            startDate,
            endDate,
            students: students || []
        });

        res.status(201).json({
            success: true,
            message: 'Batch created successfully',
            batch
        });
    } catch (error) {
        console.error('Create batch error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get all batches
// @route   GET /api/batches
// @access  Private (Admin or Tutor)
export const getBatches = async (req, res) => {
    try {
        let filter = {};

        // Tutors only see their own batches
        if (req.user.role === 'tutor') {
            if (!req.user.tutorId) return res.status(403).json({ success: false, message: 'No tutor profile found' });
            filter.tutorId = req.user.tutorId;
        }

        if (req.tenant) filter.instituteId = req.tenant._id;

        const batches = await Batch.find(filter)
            .populate('courseId', 'title thumbnail')
            .populate('tutorId') // optionally populate more if needed
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: batches.length,
            batches
        });
    } catch (error) {
        console.error('Get batches error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get batches for a student
// @route   GET /api/batches/my
// @access  Private (Student)
export const getMyBatches = async (req, res) => {
    try {
        const batches = await Batch.find({ students: req.user.id })
            .populate('courseId', 'title thumbnail')
            .populate({
                path: 'tutorId',
                populate: { path: 'userId', select: 'name profileImage' }
            })
            .sort({ startDate: -1 });

        res.status(200).json({
            success: true,
            count: batches.length,
            batches
        });
    } catch (error) {
        console.error('Get my batches error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get single batch details
// @route   GET /api/batches/:id
// @access  Private
export const getBatchById = async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.id)
            .populate('courseId', 'title')
            .populate('students', 'name email profileImage')
            .populate({
                path: 'tutorId',
                populate: { path: 'userId', select: 'name email profileImage' }
            });

        if (!batch) {
            return res.status(404).json({ success: false, message: 'Batch not found' });
        }

        // Authorization check
        if (req.user.role === 'tutor' && batch.tutorId._id.toString() !== req.user.tutorId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this batch' });
        }
        if (req.user.role === 'student' && !batch.students.some(s => s._id.toString() === req.user.id)) {
            return res.status(403).json({ success: false, message: 'You are not a part of this batch' });
        }

        res.status(200).json({
            success: true,
            batch
        });
    } catch (error) {
        console.error('Get batch by id error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Add or remove students from a batch
// @route   PUT /api/batches/:id/students
// @access  Private (Admin or Tutor)
export const updateBatchStudents = async (req, res) => {
    try {
        const { studentIds } = req.body; // Array of student user ObjectIds

        if (!Array.isArray(studentIds)) {
            return res.status(400).json({ success: false, message: 'studentIds must be an array' });
        }

        const batch = await Batch.findById(req.params.id);

        if (!batch) {
            return res.status(404).json({ success: false, message: 'Batch not found' });
        }

        if (req.user.role === 'tutor' && batch.tutorId.toString() !== req.user.tutorId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this batch' });
        }

        batch.students = studentIds;
        await batch.save();

        res.status(200).json({
            success: true,
            message: 'Batch students updated successfully',
            batch
        });
    } catch (error) {
        console.error('Update batch students error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Add announcement to batch
// @route   POST /api/batches/:id/announcements
// @access  Private (Admin or Tutor)
export const addBatchAnnouncement = async (req, res) => {
    try {
        const { title, message } = req.body;

        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }

        const batch = await Batch.findById(req.params.id);
        if (!batch) {
            return res.status(404).json({ success: false, message: 'Batch not found' });
        }

        if (req.user.role === 'tutor' && batch.tutorId.toString() !== req.user.tutorId?.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        batch.announcements.push({ title, message });
        await batch.save();

        res.status(201).json({
            success: true,
            message: 'Announcement posted successfully',
            announcements: batch.announcements,
        });
    } catch (error) {
        console.error('Add batch announcement error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get batch performance analytics
// @route   GET /api/batches/:id/analytics
// @access  Private (Admin or Tutor)
export const getBatchAnalytics = async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.id).populate('students', 'name email');
        if (!batch) {
            return res.status(404).json({ success: false, message: 'Batch not found' });
        }

        if (req.user.role === 'tutor' && batch.tutorId.toString() !== req.user.tutorId?.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        // Aggregate exam results for batch students
        const ExamResult = mongoose.model('ExamResult');
        const studentIds = batch.students.map(s => s._id);

        const results = await ExamResult.find({ studentId: { $in: studentIds } })
            .populate('examId', 'title')
            .lean();

        const totalStudents = studentIds.length;
        const avgScore = results.length > 0
            ? Math.round(results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length)
            : 0;
        const passCount = results.filter(r => (r.percentage || 0) >= 40).length;
        const failCount = results.length - passCount;

        // Per-student summary
        const studentSummary = batch.students.map(s => {
            const studentResults = results.filter(r => r.studentId?.toString() === s._id.toString());
            const avg = studentResults.length > 0
                ? Math.round(studentResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / studentResults.length)
                : 0;
            return {
                student: { _id: s._id, name: s.name, email: s.email },
                examsTaken: studentResults.length,
                avgScore: avg,
            };
        });

        res.status(200).json({
            success: true,
            analytics: {
                totalStudents,
                totalExamResults: results.length,
                avgScore,
                passCount,
                failCount,
                passRate: results.length > 0 ? Math.round((passCount / results.length) * 100) : 0,
                studentSummary,
            },
        });
    } catch (error) {
        console.error('Get batch analytics error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
