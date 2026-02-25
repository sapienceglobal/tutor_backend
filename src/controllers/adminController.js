import User from '../models/User.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';

// @desc    Get Admin Dashboard Stats
// @route   GET /api/admin/stats
// @access  Private (Admin)
export const getAdminStats = async (req, res) => {
    try {
        // 1. Total Counts
        const totalTutors = await User.countDocuments({ role: 'tutor' });
        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalCourses = await Course.countDocuments();
        const activeCourses = await Course.countDocuments({ status: 'published' });

        // 2. Global Financials
        const allEnrollments = await Enrollment.find({ status: 'active' }).populate('courseId', 'price');
        const totalRevenue = allEnrollments.reduce((sum, enr) => sum + (enr.courseId?.price || 0), 0);

        // 3. Real Trend Calculation (Current Month vs Last Month)
        const now = new Date();
        const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Helper for percentage change
        const calculateTrend = (current, previous) => {
            if (previous === 0) return current === 0 ? 0 : null; // null indicates "New"
            return ((current - previous) / previous) * 100;
        };

        // Users Trend
        const currentMonthUsers = await User.countDocuments({ createdAt: { $gte: firstDayCurrentMonth } });
        const lastMonthUsers = await User.countDocuments({
            createdAt: { $gte: firstDayLastMonth, $lte: lastDayLastMonth }
        });
        const usersTrend = calculateTrend(currentMonthUsers, lastMonthUsers);

        // Courses Trend (Published)
        const currentMonthCourses = await Course.countDocuments({
            status: 'published',
            createdAt: { $gte: firstDayCurrentMonth }
        });
        const lastMonthCourses = await Course.countDocuments({
            status: 'published',
            createdAt: { $gte: firstDayLastMonth, $lte: lastDayLastMonth }
        });
        const coursesTrend = calculateTrend(currentMonthCourses, lastMonthCourses);

        // Revenue Trend
        const currentMonthRevenue = (await Enrollment.find({
            createdAt: { $gte: firstDayCurrentMonth }
        }).populate('courseId', 'price')).reduce((sum, e) => sum + (e.courseId?.price || 0), 0);

        const lastMonthRevenue = (await Enrollment.find({
            createdAt: { $gte: firstDayLastMonth, $lte: lastDayLastMonth }
        }).populate('courseId', 'price')).reduce((sum, e) => sum + (e.courseId?.price || 0), 0);

        const earningsTrend = calculateTrend(currentMonthRevenue, lastMonthRevenue);

        const trends = {
            users: usersTrend,
            earnings: earningsTrend,
            courses: coursesTrend
        };

        // 4. Recent Registrations (Using User model)
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('-password name email role createdAt profileImage');

        // 5. Monthly Data (Chart) - Real Aggregation
        const monthlyData = Array.from({ length: 7 }, (_, i) => { // Last 7 months
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return {
                name: d.toLocaleString('default', { month: 'short' }),
                students: 0,
                enrollments: 0
            };
        }).reverse();

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setDate(1);

        // Get enrollments for last 6 months
        const recentEnrollments = await Enrollment.find({
            createdAt: { $gte: sixMonthsAgo }
        });

        recentEnrollments.forEach(enr => {
            const date = new Date(enr.createdAt);
            const monthName = date.toLocaleString('default', { month: 'short' });
            const monthParams = monthlyData.find(m => m.name === monthName);
            if (monthParams) {
                monthParams.enrollments += 1;
            }
        });

        // Get new students for last 6 months
        const newStudents = await User.find({
            role: 'student',
            createdAt: { $gte: sixMonthsAgo }
        });

        newStudents.forEach(user => {
            const date = new Date(user.createdAt);
            const monthName = date.toLocaleString('default', { month: 'short' });
            const monthParams = monthlyData.find(m => m.name === monthName);
            if (monthParams) {
                monthParams.students += 1;
            }
        });

        res.status(200).json({
            success: true,
            stats: {
                totalTutors,
                totalStudents,
                totalCourses,
                activeCourses,
                totalRevenue,
                trends,
                recentUsers,
                monthlyData // <--- Added this
            }
        });

    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// @desc    Get all tutors
// @route   GET /api/admin/tutors
// @access  Private (Admin)
export const getAllTutors = async (req, res) => {
    try {
        const tutors = await User.find({ role: 'tutor' })
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: tutors.length, tutors });
    } catch (error) {
        console.error('Get tutors error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get all students
// @route   GET /api/admin/students
// @access  Private (Admin)
export const getAllStudents = async (req, res) => {
    try {
        const students = await User.find({ role: 'student' })
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: students.length, students });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get all courses
// @route   GET /api/admin/courses
// @access  Private (Admin)
export const getAllCourses = async (req, res) => {
    try {
        const courses = await Course.find()
            .populate('tutorId', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: courses.length, courses });
    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        await user.deleteOne();
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Delete course
// @route   DELETE /api/admin/courses/:id
// @access  Private (Admin)
export const deleteCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        await course.deleteOne();
        res.status(200).json({ success: true, message: 'Course deleted successfully' });
    } catch (error) {
        console.error('Delete course error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get Detailed Stats (Charts)
// @route   GET /api/admin/stats/detailed
// @access  Private (Admin)
export const getDetailedStats = async (req, res) => {
    try {
        // 1. User Growth (Last 6 months) - Aggregation
        // Note: In production, consider using a proper timeseries db or more optimized query
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const userGrowth = await User.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // 2. Course Distribution by Category (Mocked if categories not strict, or aggregation)
        // Assuming courses have categories, let's group by them
        const courseCategories = await Course.aggregate([
            {
                $group: {
                    _id: "$category", // Make sure this field exists or use a default
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // 3. User Role Distribution
        const userDistribution = await User.aggregate([
            {
                $group: {
                    _id: "$role",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            charts: {
                userGrowth,
                courseCategories,
                userDistribution
            }
        });

    } catch (error) {
        console.error('Detailed stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get Financial Stats
// @route   GET /api/admin/earnings
// @access  Private (Admin)
export const getFinancialStats = async (req, res) => {
    try {
        const enrollments = await Enrollment.find({ status: 'active' })
            .populate('courseId', 'title price')
            .populate('studentId', 'name email')
            .sort({ createdAt: -1 });

        // Calculate Total Revenue
        const totalRevenue = enrollments.reduce((acc, curr) => acc + (curr.courseId?.price || 0), 0);

        // Calculate Monthly Revenue (Last 6 months)
        const monthlyRevenue = {};
        enrollments.forEach(enr => {
            const date = new Date(enr.createdAt);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const price = enr.courseId?.price || 0;
            if (monthlyRevenue[key]) {
                monthlyRevenue[key] += price;
            } else {
                monthlyRevenue[key] = price;
            }
        });

        // Format for chart
        const revenueChart = Object.keys(monthlyRevenue)
            .sort()
            .slice(-6)
            .map(key => ({
                name: key,
                revenue: monthlyRevenue[key]
            }));

        // Recent Transactions
        const recentTransactions = enrollments.slice(0, 10).map(enr => ({
            id: enr._id,
            student: enr.studentId?.name || 'Unknown Student',
            course: enr.courseId?.title || 'Unknown Course',
            amount: enr.courseId?.price || 0,
            date: enr.createdAt,
            status: 'Completed' // Mock status as enrollments are usually successful
        }));

        res.status(200).json({
            success: true,
            financials: {
                totalRevenue,
                revenueChart,
                recentTransactions
            }
        });

    } catch (error) {
        console.error('Financial stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get System Logs (Mocked for Demo)
// @route   GET /api/admin/logs
// @access  Private (Admin)
export const getSystemLogs = async (req, res) => {
    try {
        // Industry level logging usually involves ELK stack or similar.
        // For this app, we will simulate logs based on recent user/course creation

        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('name role createdAt');
        const recentCourses = await Course.find().sort({ createdAt: -1 }).limit(5).select('title tutorId createdAt');

        const logs = [];

        recentUsers.forEach(user => {
            logs.push({
                type: 'User Registration',
                message: `New ${user.role} registered: ${user.name}`,
                timestamp: user.createdAt,
                severity: 'info'
            });
        });

        recentCourses.forEach(course => {
            logs.push({
                type: 'Course Created',
                message: `New course created: ${course.title}`,
                timestamp: course.createdAt,
                severity: 'success'
            });
        });

        // Add some simulated system events
        logs.push({
            type: 'System',
            message: 'Daily backup completed successfully',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
            severity: 'system'
        });

        logs.push({
            type: 'Security',
            message: 'Failed login attempt from IP 192.168.1.1',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
            severity: 'warning'
        });

        // Sort by timestamp desc
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.status(200).json({
            success: true,
            logs
        });

    } catch (error) {
        console.error('System logs error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get Tutor Details
// @route   GET /api/admin/tutors/:id
// @access  Private (Admin)
export const getTutorDetails = async (req, res) => {
    try {
        const tutor = await User.findById(req.params.id).select('-password');
        if (!tutor || tutor.role !== 'tutor') {
            return res.status(404).json({ success: false, message: 'Tutor not found' });
        }

        // Ensure we find courses regardless of how tutorId is stored (string vs objectId)
        // Try both precise match and string match if needed, but standard find should work if schema is correct.
        // Let's debug by fetching all courses and filtering in JS if needed, or trust the query.
        const courses = await Course.find({ tutorId: tutor._id });

        // Logic to calculate stats
        const totalCourses = courses.length;
        const courseIds = courses.map(c => c._id);

        // Calculate earnings and students from Enrollments
        // We need to look for enrollments where courseId is in the list of this tutor's courses
        const allEnrollments = await Enrollment.find({
            courseId: { $in: courseIds },
            status: { $ne: 'cancelled' } // Include active and completed
        }).populate('courseId', 'price title');

        const totalStudents = new Set(allEnrollments.map(e => e.studentId.toString())).size;
        const totalEarnings = allEnrollments.reduce((sum, enr) => {
            // Use the price from the populated course, or 0
            return sum + (enr.courseId?.price || 0);
        }, 0);

        res.status(200).json({
            success: true,
            tutor,
            stats: {
                totalCourses,
                totalStudents,
                totalEarnings
            },
            courses
        });

    } catch (error) {
        console.error('Get tutor details error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get Student Details
// @route   GET /api/admin/students/:id
// @access  Private (Admin)
export const getStudentDetails = async (req, res) => {
    try {
        const student = await User.findById(req.params.id).select('-password');
        if (!student || student.role !== 'student') {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        const enrollments = await Enrollment.find({ studentId: student._id })
            .populate('courseId', 'title price thumbnail level')
            .sort({ createdAt: -1 });

        const totalSpent = enrollments.reduce((sum, enr) => sum + (enr.courseId?.price || 0), 0);

        res.status(200).json({
            success: true,
            student,
            stats: {
                totalEnrolled: enrollments.length,
                totalSpent
            },
            enrollments
        });

    } catch (error) {
        console.error('Get student details error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get Course Details (Admin View)
// @route   GET /api/admin/courses/:id
// @access  Private (Admin)
export const getAdminCourseDetails = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id).populate('tutorId', 'name email profileImage');
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        const enrollments = await Enrollment.find({ courseId: course._id })
            .populate('studentId', 'name email profileImage')
            .sort({ createdAt: -1 });

        const totalRevenue = enrollments.length * (course.price || 0);

        res.status(200).json({
            success: true,
            course,
            stats: {
                totalStudents: enrollments.length,
                totalRevenue
            },
            students: enrollments.map(e => ({
                id: e._id, // Enrollment ID is always unique and present
                _id: e.studentId?._id,
                name: e.studentId?.name || 'Unknown User',
                email: e.studentId?.email || 'N/A',
                enrolledAt: e.createdAt,
                progress: e.progress?.percentage || 0
            }))
        });

    } catch (error) {
        console.error('Get course details error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
