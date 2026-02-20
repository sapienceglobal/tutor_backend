
import Attendance from '../models/Attendance.js';
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
