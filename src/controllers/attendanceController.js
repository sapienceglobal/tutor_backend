import Attendance from '../models/Attendance.js';
import BatchAttendance from '../models/BatchAttendance.js';
import Batch from '../models/Batch.js';
import LiveClass from '../models/LiveClass.js';
import Enrollment from '../models/Enrollment.js';
import User from '../models/User.js';
import Tutor from '../models/Tutor.js';

// Helper to check ownership
const isTutorOwner = async (userId, classTutorId) => {
    const tutor = await Tutor.findOne({ userId });
    return tutor && tutor._id.toString() === classTutorId.toString();
};

// @desc    Get Detailed Attendance Report for a Class
// @route   GET /api/live-classes/:id/attendance-report
// @access  Private (Tutor/Admin)
export const getClassAttendanceReport = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get Class Details
        const liveClass = await LiveClass.findById(id);
        if (!liveClass) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }

        // Verify ownership (if tutor)
        // Verify ownership (if tutor)
        if (req.user.role === 'tutor') {
            // Find Tutor profile for this user
            // We need to import Tutor model at the top first
            // Assuming Tutor is not imported yet, I will add it or use mongoose.model('Tutor')
            // Better to just fix the logic here.

            // Check if I can import Tutor. 
            // Logic: liveClass.tutorId is a Tutor ID. req.user._id is a User ID.
            // We need to match them.

            const isOwner = await isTutorOwner(req.user._id, liveClass.tutorId);
            if (!isOwner) {
                return res.status(403).json({ success: false, message: 'Not authorized' });
            }
        }

        // 2. Get All Enrolled Students for this Course
        // We need detailed student info (name, email, avatar)
        const enrollments = await Enrollment.find({ courseId: liveClass.courseId })
            .populate('studentId', 'name email avatar');

        // 3. Get All Attendance Records for this Class
        const attendanceRecords = await Attendance.find({ liveClassId: id });

        // Map for quick lookup
        const attendanceMap = {};
        attendanceRecords.forEach(record => {
            attendanceMap[record.studentId.toString()] = record;
        });

        // 4. Merge Data (Enrolled vs Present)
        const report = enrollments.map(enrollment => {
            const student = enrollment.studentId;
            if (!student) return null; // Skip if student deleted

            const attendance = attendanceMap[student._id.toString()];

            return {
                studentId: student._id,
                name: student.name,
                email: student.email,
                avatar: student.avatar,
                status: attendance ? 'Present' : 'Absent',
                joinedAt: attendance ? attendance.joinedAt : null,
                duration: attendance ? 'Joined' : '-' // Duration tracking not available yet
            };
        }).filter(Boolean); // Remove nulls

        // 5. Calculate Summary Stats
        const totalEnrolled = report.length;
        const totalPresent = report.filter(r => r.status === 'Present').length;
        const totalAbsent = totalEnrolled - totalPresent;
        const attendancePercentage = totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 0;

        res.status(200).json({
            success: true,
            data: {
                classDetails: {
                    title: liveClass.title,
                    dateTime: liveClass.dateTime,
                    duration: liveClass.duration
                },
                stats: {
                    totalEnrolled,
                    totalPresent,
                    totalAbsent,
                    attendancePercentage
                },
                students: report
            }
        });

    } catch (error) {
        console.error('Attendance Report Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Mark attendance for a batch on a specific date
// @route   POST /api/attendance/batch
// @access  Private (Tutor only)
export const markAttendance = async (req, res) => {
    try {
        const { batchId, date, records } = req.body;

        if (!batchId || !date || !records || !Array.isArray(records)) {
            return res.status(400).json({ success: false, message: 'Please provide batchId, date, and records array' });
        }

        const batch = await Batch.findById(batchId);
        if (!batch) {
            return res.status(404).json({ success: false, message: 'Batch not found' });
        }

        const isOwner = await isTutorOwner(req.user._id, batch.tutorId);
        if (!isOwner) {
            return res.status(403).json({ success: false, message: 'Not authorized to mark attendance for this batch' });
        }

        // Normalize date to start of day
        const targetDate = new Date(date);
        targetDate.setHours(0,0,0,0);

        // Check if attendance already exists for this date
        let attendance = await BatchAttendance.findOne({ batchId, date: targetDate });

        if (attendance) {
            // Update existing
            attendance.records = records;
            await attendance.save();
        } else {
            // Create new
            const tutor = await Tutor.findOne({ userId: req.user._id });
            attendance = await BatchAttendance.create({
                batchId,
                tutorId: tutor._id,
                date: targetDate,
                records
            });
        }

        res.status(200).json({
            success: true,
            message: 'Attendance marked successfully',
            attendance
        });
    } catch (error) {
        console.error('Mark attendance error:', error);
        if (error.code === 11000) {
             return res.status(400).json({ success: false, message: 'Attendance for this date already exists.' });
        }
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get attendance records for a specific batch
// @route   GET /api/attendance/batch/:batchId
// @access  Private (Tutor or Admin or enrolled Student)
export const getBatchAttendance = async (req, res) => {
    try {
        const batch = await Batch.findById(req.params.batchId);
        if (!batch) {
            return res.status(404).json({ success: false, message: 'Batch not found' });
        }

        // Auth checks
        if (req.user.role === 'tutor') {
            const isOwner = await isTutorOwner(req.user._id, batch.tutorId);
            if (!isOwner) return res.status(403).json({ success: false, message: 'Not authorized' });
        }

        if (req.user.role === 'student' && !batch.students.includes(req.user.id)) {
            return res.status(403).json({ success: false, message: 'You are not in this batch' });
        }

        const attendanceRecords = await BatchAttendance.find({ batchId: req.params.batchId })
            .populate('records.studentId', 'name email profileImage')
            .sort({ date: -1 });

        let processedRecords = attendanceRecords;
        if (req.user.role === 'student') {
             processedRecords = attendanceRecords.map(doc => {
                 const studentRecord = doc.records.find(r => r.studentId._id.toString() === req.user.id);
                 return {
                     _id: doc._id,
                     date: doc.date,
                     student: studentRecord?.studentId,
                     status: studentRecord ? studentRecord.status : 'N/A',
                     remarks: studentRecord ? studentRecord.remarks : ''
                 };
             });
        }

        res.status(200).json({
            success: true,
            records: processedRecords
        });
    } catch (error) {
        console.error('Get batch attendance error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
