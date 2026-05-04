import Batch from '../models/Batch.js';
import User from '../models/User.js';
import Tutor from '../models/Tutor.js';
import Course from '../models/Course.js';
import { ExamAttempt } from '../models/Exam.js';
import Enrollment from '../models/Enrollment.js';
import mongoose from 'mongoose';
import { createNotification } from './notificationController.js';

// @desc    Create a new batch
// @route   POST /api/batches
// @access  Private (Admin or Tutor)
export const createBatch = async (req, res) => {
    try {
        const { name, courseId, scheduleDescription, startDate, endDate, students, grade, instructors } = req.body;

        let tutorId;
        let finalInstructors = Array.isArray(instructors) ? instructors : [];

        if (req.user.role === 'tutor') {
            const tutor = await Tutor.findOne({ userId: req.user._id });
            if (!tutor) {
                return res.status(404).json({ success: false, message: 'Tutor profile not found' });
            }
            tutorId = tutor._id;
            if (!finalInstructors.some(id => id.toString() === tutorId.toString())) {
                finalInstructors.unshift(tutorId);
            }
        } else {
            // Admin creating — use provided tutorId or derive from instructors list
            tutorId = req.body.tutorId || (finalInstructors.length > 0 ? finalInstructors[0] : null);
            if (tutorId && !finalInstructors.map(id => id.toString()).includes(tutorId.toString())) {
                finalInstructors.unshift(tutorId);
            }
        }

        if (!name || !courseId || !startDate || !tutorId) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields (name, courseId, startDate, tutorId)' });
        }

        if (startDate) {
            const startDateObj = new Date(startDate);
            if (isNaN(startDateObj.getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid startDate format' });
            }
        }

        if (endDate) {
            const endDateObj = new Date(endDate);
            if (isNaN(endDateObj.getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid endDate format' });
            }
        }

        const batch = await Batch.create({
            name,
            courseId,
            tutorId,
            instructors: finalInstructors,
            grade,
            instituteId: req.tenant?._id || null,
            scheduleDescription,
            startDate,
            endDate,
            students: students || []
        });

     // Sync enrollments (Update existing, Create for unenrolled)
        if (students && students.length > 0) {
            const bulkOps = students.map(studentId => ({
                updateOne: {
                    filter: { studentId, courseId },
                    update: { $set: { studentId, courseId, batchId: batch._id, status: 'active' } },
                    upsert: true
                }
            }));
            await Enrollment.bulkWrite(bulkOps);
        }

        res.status(201).json({ success: true, message: 'Batch created successfully', batch });
    } catch (error) {
        console.error('❌ Create batch error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

// @desc    Update a batch (full update)
// @route   PUT /api/batches/:id
// @access  Private (Admin or Tutor)
export const updateBatch = async (req, res) => {
    try {
        const { name, courseId, grade, startDate, endDate, scheduleDescription, instructors, students } = req.body;

        const batch = await Batch.findById(req.params.id);
        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

        if (req.user.role === 'tutor') {
            const tutor = await Tutor.findOne({ userId: req.user._id });
            if (!tutor) return res.status(403).json({ success: false, message: 'No tutor profile found' });
            if (batch.tutorId.toString() !== tutor._id.toString()) {
                return res.status(403).json({ success: false, message: 'Not authorized to update this batch' });
            }
        }

        if (name) batch.name = name;
        if (courseId) batch.courseId = courseId;
        if (grade !== undefined) batch.grade = grade;
        if (startDate) batch.startDate = startDate;
        if (endDate) batch.endDate = endDate;
        if (scheduleDescription !== undefined) batch.scheduleDescription = scheduleDescription;
        if (Array.isArray(instructors)) batch.instructors = instructors;

        if (Array.isArray(students)) {
            const previousStudents = batch.students.map(s => s.toString());
            batch.students = students;

            const removedStudents = previousStudents.filter(id => !students.includes(id));
            if (removedStudents.length > 0) {
                await Enrollment.updateMany(
                    { studentId: { $in: removedStudents }, courseId: batch.courseId, batchId: batch._id },
                    { $set: { batchId: null } }
                );
            }
         // ✅Auto-enroll unenrolled students during batch edit
            if (students.length > 0) {
                const bulkOps = students.map(studentId => ({
                    updateOne: {
                        filter: { studentId, courseId: batch.courseId },
                        update: { $set: { studentId, courseId: batch.courseId, batchId: batch._id, status: 'active' } },
                        upsert: true
                    }
                }));
                await Enrollment.bulkWrite(bulkOps);
            }
        }

        await batch.save();
        res.status(200).json({ success: true, message: 'Batch updated successfully', batch });
    } catch (error) {
        console.error('Update batch error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
};

// @desc    Get all batches
// @route   GET /api/batches
// @access  Private (Admin or Tutor)
export const getBatches = async (req, res) => {
    try {
        let filter = {};

        // Tutors only see batches they own or co-instruct
        if (req.user.role === 'tutor') {
            const tutor = await Tutor.findOne({ userId: req.user._id });
            if (!tutor) return res.status(403).json({ success: false, message: 'No tutor profile found' });
            filter.$or = [
                { tutorId: tutor._id },
                { instructors: tutor._id }
            ];
        }

        if (req.tenant) filter.instituteId = req.tenant._id;

        const batches = await Batch.find(filter)
            .populate('courseId', 'title thumbnail isFree status')
            .populate({
                path: 'tutorId',
                populate: { path: 'userId', select: 'name profileImage' }
            })
            .populate({
                path: 'instructors',
                populate: { path: 'userId', select: 'name profileImage' }
            })
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: batches.length, batches });
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
        const studentId = req.user._id; 
        let filter = { students: studentId };
    

        if (req.query.scope === 'global') {
            filter.instituteId = null;
        } else if (req.query.scope === 'institute') {
            filter.instituteId = req.tenant ? req.tenant._id : { $ne: null };
        } else if (req.query.scope === 'strict') {
            if (req.tenant) filter.instituteId = req.tenant._id;
        } else if (req.tenant) {
            filter.instituteId = req.tenant._id;
        }

        const batches = await Batch.find(filter)
            .populate('courseId', 'title thumbnail isFree status')
            .populate({
                path: 'tutorId',
                populate: { path: 'userId', select: 'name profileImage' }
            })
            .populate({
                path: 'instructors',
                populate: { path: 'userId', select: 'name profileImage' }
            })
            .sort({ startDate: -1 });

        const activeEnrollments = await Enrollment.find({ studentId, status: 'active' }).select('courseId').lean();
        const enrolledCourseIds = new Set(activeEnrollments.map((enrollment) => enrollment.courseId.toString()));
        const joinableBatches = batches.filter((batch) => {
            const course = batch.courseId;
            if (!course || course.status !== 'published') return false;
            return course.isFree || enrolledCourseIds.has(course._id.toString());
        });

        res.status(200).json({ success: true, count: joinableBatches.length, batches: joinableBatches });
    } catch (error) {
        console.error('Get my batches error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get all available batches for a student to browse and self-join
// @route   GET /api/batches/available
// @access  Private (Student)
export const getAvailableBatches = async (req, res) => {
    try {
        const studentId = req.user._id;

        // Build scope filter — include institute batches + global batches
        const scopeFilter = req.tenant
            ? { $or: [{ instituteId: req.tenant._id }, { instituteId: null }] }
            : { instituteId: null };

        // Exclude batches the student has already joined
        const batches = await Batch.find({
            ...scopeFilter,
            students: { $ne: studentId },
            status: { $ne: 'inactive' },
        })
            .populate('courseId', 'title thumbnail')
            .populate({
                path: 'tutorId',
                populate: { path: 'userId', select: 'name profileImage' }
            })
            .populate({
                path: 'instructors',
                populate: { path: 'userId', select: 'name profileImage' }
            })
            .sort({ startDate: 1 })
            .lean();

        res.status(200).json({ success: true, count: batches.length, batches });
    } catch (error) {
        console.error('Get available batches error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Student self-joins a batch
// @route   POST /api/batches/:id/join
// @access  Private (Student)
export const joinBatch = async (req, res) => {
    try {
        const studentId = req.user._id;
        const batch = await Batch.findById(req.params.id);

        if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
        if (batch.instituteId && req.tenant?._id?.toString() !== batch.instituteId.toString()) {
            return res.status(403).json({ success: false, message: 'This batch is not available in your institute' });
        }
        if (batch.students.map(s => s.toString()).includes(studentId.toString())) {
            return res.status(400).json({ success: false, message: 'You have already joined this batch' });
        }

        const course = await Course.findById(batch.courseId).select('isFree status title');
        if (!course || course.status !== 'published') {
            return res.status(403).json({ success: false, message: 'The linked course is not currently available' });
        }

        let enrollment = await Enrollment.findOne({ studentId, courseId: batch.courseId });
        if (enrollment && enrollment.status !== 'active') {
            return res.status(403).json({ success: false, message: 'Your course enrollment is not active yet' });
        }
        if (!enrollment && !course.isFree) {
            return res.status(403).json({ success: false, message: 'Enroll in the linked course before joining this batch' });
        }

        batch.students.push(studentId);
        await batch.save();

        if (enrollment) {
            enrollment.batchId = batch._id;
            await enrollment.save();
        } else {
            enrollment = await Enrollment.create({
                studentId,
                courseId: batch.courseId,
                batchId: batch._id,
                status: 'active',
            });
        }

        res.status(200).json({ success: true, message: 'Successfully joined the batch', batch, enrollment });
    } catch (error) {
        console.error('Join batch error:', error);
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
            })
            .populate({
                path: 'instructors',
                populate: { path: 'userId', select: 'name email profileImage' }
            });

        if (!batch) {
            return res.status(404).json({ success: false, message: 'Batch not found' });
        }

        // Authorization check
        if (req.user.role === 'tutor') {
            const tutor = await Tutor.findOne({ userId: req.user._id });
            if (!tutor) return res.status(403).json({ success: false, message: 'No tutor profile found' });

            const isOwner = batch.tutorId?._id?.toString() === tutor._id.toString();
            const isInstructor = batch.instructors?.some(inst => inst._id?.toString() === tutor._id.toString());

            if (!isOwner && !isInstructor) {
                return res.status(403).json({ success: false, message: 'Not authorized to view this batch' });
            }
        }

        if (req.user.role === 'student' && !batch.students.some(s => s._id.toString() === req.user.id)) {
            return res.status(403).json({ success: false, message: 'You are not a part of this batch' });
        }

        res.status(200).json({ success: true, batch });
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
        const { studentIds } = req.body;

        if (!Array.isArray(studentIds)) {
            return res.status(400).json({ success: false, message: 'studentIds must be an array' });
        }

        const batch = await Batch.findById(req.params.id);

        if (!batch) {
            return res.status(404).json({ success: false, message: 'Batch not found' });
        }

        if (req.user.role === 'tutor') {
            const tutor = await Tutor.findOne({ userId: req.user._id });
            if (!tutor) return res.status(403).json({ success: false, message: 'No tutor profile found' });

            if (batch.tutorId.toString() !== tutor._id.toString()) {
                return res.status(403).json({ success: false, message: 'Not authorized to update this batch' });
            }
        }

        const previousStudents = batch.students.map(s => s.toString());
        batch.students = studentIds;
        await batch.save();

        // Unset batchId for students removed from this batch
        const removedStudents = previousStudents.filter(id => !studentIds.includes(id));
        if (removedStudents.length > 0) {
            await Enrollment.updateMany(
                { studentId: { $in: removedStudents }, courseId: batch.courseId, batchId: batch._id },
                { $set: { batchId: null } }
            );
        }

     // Auto-enroll unenrolled students during Direct Student Add
        if (studentIds.length > 0) {
            const bulkOps = studentIds.map(studentId => ({
                updateOne: {
                    filter: { studentId, courseId: batch.courseId },
                    update: { $set: { studentId, courseId: batch.courseId, batchId: batch._id, status: 'active' } },
                    upsert: true
                }
            }));
            await Enrollment.bulkWrite(bulkOps);
        }

        res.status(200).json({ success: true, message: 'Batch students updated successfully', batch });
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

        if (req.user.role === 'tutor') {
            const tutor = await Tutor.findOne({ userId: req.user._id });
            if (!tutor) return res.status(403).json({ success: false, message: 'No tutor profile found' });

            if (batch.tutorId.toString() !== tutor._id.toString()) {
                return res.status(403).json({ success: false, message: 'Not authorized' });
            }
        }

        batch.announcements.push({ title, message });
        await batch.save();

        try {
            const studentIds = Array.isArray(batch.students) ? batch.students : [];
            await Promise.allSettled(
                studentIds.map((studentId) =>
                    createNotification({
                        userId: studentId,
                        type: 'announcement',
                        title: `Batch Announcement: ${title}`,
                        message,
                        data: { batchId: batch._id, courseId: batch.courseId },
                    })
                )
            );
        } catch (notificationError) {
            console.error('Batch announcement notification error:', notificationError);
        }

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

        if (req.user.role === 'tutor') {
            const tutor = await Tutor.findOne({ userId: req.user._id });
            if (!tutor) return res.status(403).json({ success: false, message: 'No tutor profile found' });

            if (batch.tutorId.toString() !== tutor._id.toString()) {
                return res.status(403).json({ success: false, message: 'Not authorized' });
            }
        }

        const studentIds = batch.students.map(s => s._id);
        const results = await ExamAttempt.find({ studentId: { $in: studentIds } })
            .populate('examId', 'title')
            .lean();

        const totalStudents = studentIds.length;
        const avgScore = results.length > 0
            ? Math.round(results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length)
            : 0;
        const passCount = results.filter(r => (r.percentage || 0) >= 40).length;
        const failCount = results.length - passCount;

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
