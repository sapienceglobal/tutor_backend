
// @desc    Get tutor stats (dashboard)
// @route   GET /api/tutors/stats
export const getTutorStats = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Get Tutor Profile
        const tutor = await Tutor.findOne({ userId });
        if (!tutor) {
            return res.status(404).json({ success: false, message: 'Tutor profile not found' });
        }

        // 2. Get Courses
        // Dynamic import to avoid circular dependency
        const Course = (await import('../models/Course.js')).default;
        const courses = await Course.find({ tutorId: tutor._id });
        const courseIds = courses.map(c => c._id);

        const activeCourses = courses.filter(c => c.status === 'published').length;
        const totalCourses = courses.length;

        // 3. Get Enrollments (Total Students & Earnings)
        const Enrollment = (await import('../models/Enrollment.js')).default;
        const enrollments = await Enrollment.find({ courseId: { $in: courseIds } })
            .populate('studentId', 'name email profileImage')
            .populate('courseId', 'title price thumbnail')
            .sort({ enrolledAt: -1 });

        // Calculate Total Earnings
        const totalEarnings = enrollments.reduce((sum, enrollment) => {
            return sum + (enrollment.courseId?.price || 0);
        }, 0);

        // Calculate Unique Students
        const uniqueStudents = new Set(enrollments.map(e => e.studentId?._id.toString())).size;

        // 4. Calculate Ratings
        const totalRatings = courses.reduce((sum, course) => sum + (course.rating || 0), 0);
        const avgRating = totalCourses > 0 ? (totalRatings / totalCourses).toFixed(1) : 0;

        // 5. Recent Enrollments (Last 5)
        const recentEnrollments = enrollments.slice(0, 5).map(e => ({
            _id: e._id,
            studentName: e.studentId?.name || 'Unknown',
            studentImage: e.studentId?.profileImage,
            courseTitle: e.courseId?.title || 'Unknown Course',
            price: e.courseId?.price || 0,
            enrolledAt: e.enrolledAt
        }));

        // 6. Top Courses (by enrollment count)
        const topCourses = courses
            .sort((a, b) => b.enrolledCount - a.enrolledCount)
            .slice(0, 5)
            .map(c => ({
                id: c._id,
                name: c.title,
                count: c.enrolledCount.toLocaleString(),
                trend: (c.rating || 0).toFixed(1),
                trendUp: true,
                bg: 'bg-blue-100',
                color: 'text-blue-600'
            }));

        // 7. Monthly Data (Last 12 months)
        const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return {
                name: d.toLocaleString('default', { month: 'short' }),
                website: 0,
                user: 0
            };
        }).reverse();

        enrollments.forEach(e => {
            const date = new Date(e.enrolledAt);
            const monthName = date.toLocaleString('default', { month: 'short' });
            const monthParams = monthlyData.find(m => m.name === monthName);
            if (monthParams) {
                monthParams.user += 1;
                monthParams.website += 5; // Simulating views
            }
        });

        res.status(200).json({
            success: true,
            stats: {
                totalStudents: uniqueStudents,
                activeCourses,
                totalEarnings,
                avgRating,
                recentEnrollments,
                topCourses,
                monthlyData
            }
        });

    } catch (error) {
        console.error('Get tutor stats error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
