import Enrollment from '../../models/Enrollment.js';
import { Exam } from '../../models/Exam.js';
// import { Attempt } from '../../models/Attempt.js'; // Assuming Attempt model exists or similar

// @desc    Get student dashboard activity (chart data)
// @route   GET /api/student/dashboard/activity
export const getStudentActivity = async (req, res) => {
    try {
        const studentId = req.user.id;

        // Mocking logic similar to Tutor Performance but for Student
        // In a real app, this would query "StudySession" or "LessonView" logs.
        // For now, we'll return a weekly spread of "Hours Spent" (mocked via random or enrollment data).

        const today = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const activityData = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dayName = days[d.getDay()];

            // Logic to fetch real activity:
            // const hours = await StudyLog.aggregate(...) 

            // Mock for UI:
            // Random hours between 0 and 5
            const hours = (Math.random() * 5).toFixed(1);

            activityData.push({
                name: dayName,
                hours: parseFloat(hours)
            });
        }

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
        
        // This endpoint might already be covered by /enrollments/my-enrollments for course counts
        // But for a summary widget:
        
        const enrollments = await Enrollment.find({ studentId });
        const completed = enrollments.filter(e => e.progress.percentage === 100).length;
        const inProgress = enrollments.length - completed;
        
        // Mock total hours
        const totalLearningHours = 42; 

        res.status(200).json({
            success: true,
            stats: {
                completedCourses: completed,
                inProgress,
                totalLearningHours
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
