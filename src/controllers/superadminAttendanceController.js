import Attendance from '../models/Attendance.js';

// @desc    Get global attendance stats and recent logs
// @route   GET /api/superadmin/attendance
// @access  Private/Superadmin
export const getGlobalAttendance = async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;

        // Build query for recent logs
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        // ─── 1. Fetch Recent Logs ───
        // Assuming courseId has the title, and studentId has name/email
        const recentAttendance = await Attendance.find(query)
            .populate('studentId', 'name email profileImage')
            .populate('courseId', 'title instituteId')
            .sort({ joinedAt: -1 })
            .limit(Number(limit));

        // ─── 2. Calculate Global KPIs ───
        const totalLogs = await Attendance.countDocuments();
        const presentCount = await Attendance.countDocuments({ status: 'present' });
        const lateCount = await Attendance.countDocuments({ status: 'late' });
        const absentCount = await Attendance.countDocuments({ status: 'absent' });

        // Calculate Present Percentage (Present + Late / Total)
        const totalAttended = presentCount + lateCount;
        let presentPercentage = 0;
        if (totalLogs > 0) {
            presentPercentage = ((totalAttended / totalLogs) * 100).toFixed(1);
        }

        res.status(200).json({
            success: true,
            data: {
                logs: recentAttendance,
                kpis: {
                    totalLogs,
                    presentCount,
                    lateCount,
                    absentCount,
                    presentPercentage: parseFloat(presentPercentage)
                }
            }
        });
    } catch (error) {
        console.error('Superadmin Fetch Attendance Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch global attendance data' });
    }
};