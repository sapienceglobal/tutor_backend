import Enrollment from '../../models/Enrollment.js';
import Attendance from '../../models/Attendance.js';
import User from '../../models/User.js';
import LearningEvent from '../../models/LearningEvent.js';

const EVENT_WEIGHTS = Object.freeze({
    attendance_marked: 20,
    live_class_joined: 18,
    assignment_submitted: 14,
    exam_submitted: 22,
});

const formatDayKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getLast7DaySlots = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const slots = [];
    for (let i = 6; i >= 0; i -= 1) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        d.setHours(0, 0, 0, 0);

        slots.push({
            key: formatDayKey(d),
            label: d.toLocaleString('default', { weekday: 'short' }),
            start: new Date(d),
            end: new Date(d.getTime() + (24 * 60 * 60 * 1000) - 1),
        });
    }

    return slots;
};

const getScopeMatcher = ({ scope, instituteId }) => {
    if (scope === 'global') {
        return (value) => !value;
    }

    if (scope === 'institute') {
        if (!instituteId) return () => false;
        const expected = instituteId.toString();
        return (value) => value && value.toString() === expected;
    }

    return () => true;
};

const buildScopeQuery = ({ scope, instituteId }) => {
    if (scope === 'global') {
        return { $or: [{ instituteId: null }, { instituteId: { $exists: false } }] };
    }

    if (scope === 'institute') {
        if (!instituteId) return { _id: null };
        return { instituteId };
    }

    return {};
};

// @desc    Get student dashboard activity (chart data)
// @route   GET /api/student/dashboard/activity
export const getStudentActivity = async (req, res) => {
    try {
        const studentId = req.user.id;
        const scope = req.query.scope || 'all';
        const user = await User.findById(studentId).select('instituteId').lean();
        const activeInstituteId = user?.instituteId || null;

        const slots = getLast7DaySlots();
        const firstDayStart = slots[0].start;
        const eventQuery = {
            userId: studentId,
            createdAt: { $gte: firstDayStart },
            ...buildScopeQuery({ scope, instituteId: activeInstituteId }),
        };

        const events = await LearningEvent.find(eventQuery)
            .select('eventType meta createdAt')
            .sort({ createdAt: 1 })
            .lean();

        const dayMap = new Map(slots.map((slot) => [slot.key, {
            label: slot.label,
            eventCounts: {
                attendance_marked: 0,
                live_class_joined: 0,
                assignment_submitted: 0,
                exam_submitted: 0,
            },
            examPercentages: [],
        }]));

        events.forEach((event) => {
            const key = formatDayKey(new Date(event.createdAt));
            const day = dayMap.get(key);
            if (!day) return;

            if (day.eventCounts[event.eventType] !== undefined) {
                day.eventCounts[event.eventType] += 1;
            }

            if (event.eventType === 'exam_submitted') {
                const pct = Number(event?.meta?.percentage);
                if (Number.isFinite(pct)) {
                    day.examPercentages.push(Math.max(0, Math.min(100, pct)));
                }
            }
        });

        const activityData = slots.map((slot) => {
            const day = dayMap.get(slot.key);
            const examCount = day.examPercentages.length;
            const examAverage = examCount > 0
                ? day.examPercentages.reduce((sum, v) => sum + v, 0) / examCount
                : null;

            const engagementRaw =
                (day.eventCounts.attendance_marked * EVENT_WEIGHTS.attendance_marked)
                + (day.eventCounts.live_class_joined * EVENT_WEIGHTS.live_class_joined)
                + (day.eventCounts.assignment_submitted * EVENT_WEIGHTS.assignment_submitted)
                + (day.eventCounts.exam_submitted * EVENT_WEIGHTS.exam_submitted);

            const engagementScore = Math.min(100, engagementRaw);
            const score = examAverage !== null
                ? Math.round((examAverage * 0.8) + (engagementScore * 0.2))
                : Math.round(engagementScore);

            return {
                date: slot.key,
                month: slot.label,
                name: slot.label,
                score,
                hours: Number((engagementRaw / 25).toFixed(1)),
                exams: day.eventCounts.exam_submitted,
                assignments: day.eventCounts.assignment_submitted,
                liveClasses: day.eventCounts.live_class_joined,
                attendance: day.eventCounts.attendance_marked,
            };
        });

        res.status(200).json({
            success: true,
            activity: activityData
        });

    } catch (error) {
        console.error('Get student activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// @desc    Get student dashboard stats (courses, exams, etc.)
// @route   GET /api/student/dashboard/stats
export const getStudentStats = async (req, res) => {
    try {
        const studentId = req.user.id;
        const scope = req.query.scope || 'all';

        const user = await User.findById(studentId).select('instituteId').lean();
        const activeInstituteId = user?.instituteId || null;
        const scopeMatcher = getScopeMatcher({ scope, instituteId: activeInstituteId });

        const enrollments = await Enrollment.find({ studentId, status: { $in: ['active', 'completed'] } });
        const completed = enrollments.filter((e) => e.status === 'completed' || e.progress?.percentage === 100).length;
        const inProgress = enrollments.length - completed;

        const attendanceDocs = await Attendance.find({ studentId })
            .populate('liveClassId', 'duration instituteId')
            .lean();

        const totalLearningMinutes = attendanceDocs.reduce((sum, attendance) => {
            const liveClass = attendance.liveClassId;
            if (!liveClass) return sum;
            if (!scopeMatcher(liveClass.instituteId)) return sum;
            return sum + (Number(liveClass.duration) || 0);
        }, 0);

        const examEvents = await LearningEvent.find({
            userId: studentId,
            eventType: 'exam_submitted',
            ...buildScopeQuery({ scope, instituteId: activeInstituteId }),
        }).select('meta').lean();

        const validExamPercentages = examEvents
            .map((event) => Number(event?.meta?.percentage))
            .filter((pct) => Number.isFinite(pct));

        const averageExamScore = validExamPercentages.length > 0
            ? Math.round(validExamPercentages.reduce((sum, pct) => sum + pct, 0) / validExamPercentages.length)
            : 0;

        res.status(200).json({
            success: true,
            stats: {
                completedCourses: completed,
                inProgress,
                enrolledCourses: enrollments.length,
                totalLearningHours: Number((totalLearningMinutes / 60).toFixed(1)),
                examsSubmitted: examEvents.length,
                averageExamScore,
            }
        });

    } catch (error) {
        console.error('Get student stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
