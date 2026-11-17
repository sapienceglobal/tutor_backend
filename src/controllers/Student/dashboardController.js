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

const getTimeSlots = (period = 'week') => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const p = String(period).toLowerCase();

    if (p === 'year') {
        const slots = [];
        for (let i = 5; i >= 0; i -= 1) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59, 999);
            slots.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleString('default', { month: 'short' }),
                start: d,
                end,
            });
        }
        return slots;
    }

    if (p === 'month') {
        const slots = [];
        for (let i = 3; i >= 0; i -= 1) {
            const end = new Date(today);
            end.setDate(today.getDate() - (i * 7));
            end.setHours(23, 59, 59, 999);
            const start = new Date(end);
            start.setDate(end.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            slots.push({
                key: `W${4 - i}`,
                label: `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
                start,
                end,
            });
        }
        return slots;
    }

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

const resolveWorkspaceScope = (req, fallbackInstituteId = null) => {
    if (req.workspace?.type === 'private_tutor') {
        return { mode: 'private_tutor', instituteId: null };
    }
    if (req.workspace?.type === 'institute' && req.workspace.instituteId) {
        return { mode: 'institute', instituteId: req.workspace.instituteId };
    }
    if (fallbackInstituteId) {
        return { mode: 'institute', instituteId: fallbackInstituteId };
    }
    return { mode: 'private_tutor', instituteId: null };
};

const getScopeMatcher = ({ mode, instituteId }) => {
    if (mode === 'private_tutor') {
        return (value) => !value;
    }
    if (!instituteId) return () => false;
    const expected = instituteId.toString();
    return (value) => Boolean(value && value.toString() === expected);
};

const buildScopeQuery = ({ mode, instituteId }) => {
    if (mode === 'private_tutor') {
        return { $or: [{ instituteId: null }, { instituteId: { $exists: false } }] };
    }
    if (!instituteId) return { _id: null };
    return { instituteId };
};

// @desc    Get student dashboard activity (chart data)
// @route   GET /api/student/dashboard/activity
export const getStudentActivity = async (req, res) => {
    try {
        const studentId = req.user.id;
        const user = await User.findById(studentId).select('instituteId').lean();
        const scopeCtx = resolveWorkspaceScope(req, user?.instituteId || null);

        const period = req.query.period || 'week';
        const slots = getTimeSlots(period);
        const firstDayStart = slots[0].start;
        const scopeFilter = buildScopeQuery(scopeCtx);
        const eventQuery = {
            userId: studentId,
            createdAt: { $gte: firstDayStart },
            ...scopeFilter,
        };

        const [events, allPeerExamEvents] = await Promise.all([
            LearningEvent.find(eventQuery)
                .select('eventType meta createdAt')
                .sort({ createdAt: 1 })
                .lean(),
            LearningEvent.find({
                eventType: 'exam_submitted',
                createdAt: { $gte: firstDayStart },
                ...scopeFilter,
            }).select('meta createdAt').lean(),
        ]);

        const dayMap = new Map(slots.map((slot) => [slot.key, {
            label: slot.label,
            start: slot.start,
            end: slot.end,
            eventCounts: {
                attendance_marked: 0,
                live_class_joined: 0,
                assignment_submitted: 0,
                exam_submitted: 0,
            },
            examPercentages: [],
            peerExamPercentages: [],
        }]));

        const findSlotForDate = (dt) => {
            const ts = new Date(dt).getTime();
            for (const slot of slots) {
                if (ts >= slot.start.getTime() && ts <= slot.end.getTime()) {
                    return dayMap.get(slot.key);
                }
            }
            return null;
        };

        events.forEach((event) => {
            const day = findSlotForDate(event.createdAt);
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

        allPeerExamEvents.forEach((event) => {
            const day = findSlotForDate(event.createdAt);
            if (!day) return;
            const pct = Number(event?.meta?.percentage);
            if (Number.isFinite(pct)) {
                day.peerExamPercentages.push(Math.max(0, Math.min(100, pct)));
            }
        });

        const activityData = slots.map((slot) => {
            const day = dayMap.get(slot.key);
            const examCount = day.examPercentages.length;
            const examAverage = examCount > 0
                ? day.examPercentages.reduce((sum, v) => sum + v, 0) / examCount
                : null;

            const peerCount = day.peerExamPercentages.length;
            const benchmarkScore = peerCount > 0
                ? Math.round(day.peerExamPercentages.reduce((sum, v) => sum + v, 0) / peerCount)
                : 0;

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
                benchmarkScore,
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
        const user = await User.findById(studentId).select('instituteId').lean();
        const scopeCtx = resolveWorkspaceScope(req, user?.instituteId || null);
        const scopeMatcher = getScopeMatcher(scopeCtx);

        const rawEnrollments = await Enrollment.find({
            studentId,
            status: { $in: ['active', 'completed'] },
        }).populate('courseId', 'instituteId tutorId');

        const enrollments = rawEnrollments.filter((e) => {
            if (!e.courseId) return false;
            if (!scopeMatcher(e.courseId.instituteId)) return false;
            if (scopeCtx.mode === 'private_tutor' && req.workspace?.filterTutorId) {
                return String(e.courseId.tutorId) === String(req.workspace.filterTutorId);
            }
            return true;
        });

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
            ...buildScopeQuery(scopeCtx),
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
