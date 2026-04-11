import User from '../models/User.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import bcrypt from 'bcryptjs';
import Settings from '../models/Settings.js';
import Tutor from '../models/Tutor.js';
import Institute from '../models/Institute.js';
import InstituteMembership from '../models/InstituteMembership.js';
import mongoose from 'mongoose';

const getAdminInstituteId = (req) => req.user?.instituteId || null;
const userScope = (req, extra = {}) => ({ instituteId: getAdminInstituteId(req), ...extra });
const courseScope = (req, extra = {}) => ({ instituteId: getAdminInstituteId(req), ...extra });

// @desc    Get Admin Dashboard Stats
// @route   GET /api/admin/stats
// @access  Private (Admin)
// @desc    Get Admin Dashboard Stats
// @route   GET /api/admin/stats
// @access  Private (Admin)
// @desc    Get Admin Dashboard Stats
// @route   GET /api/admin/stats
// @access  Private (Admin)
export const getAdminStats = async (req, res) => {
    try {
        const instituteId = getAdminInstituteId(req);
        const scopedUsers = userScope(req);
        const scopedCourses = courseScope(req);
        
        const instituteCourses = await Course.find(scopedCourses).select('_id price');
        const instituteCourseIds = instituteCourses.map(c => c._id);

        // ============================================
        // 1. TOTAL COUNTS (Students, Instructors, Courses, Batches)
        // ============================================
        const totalTutors = await User.countDocuments(userScope(req, { role: 'tutor' }));
        const totalStudents = await User.countDocuments(userScope(req, { role: 'student' }));
        const totalCourses = await Course.countDocuments(scopedCourses);
        
        const Batch = (await import('../models/Batch.js')).default;
        const activeBatches = await Batch.countDocuments({ instituteId, status: 'active' });

        // ============================================
        // 2. TREND CALCULATIONS (Current Month vs Last Month)
        // ============================================
        const now = new Date();
        const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const calculateTrend = (current, previous) => {
            if (previous === 0) return current === 0 ? 0 : null; // null indicates "New"
            return ((current - previous) / previous) * 100;
        };

        const currentMonthStudents = await User.countDocuments({ ...scopedUsers, role: 'student', createdAt: { $gte: firstDayCurrentMonth } });
        const lastMonthStudents = await User.countDocuments({ ...scopedUsers, role: 'student', createdAt: { $gte: firstDayLastMonth, $lte: lastDayLastMonth } });
        const studentsTrend = calculateTrend(currentMonthStudents, lastMonthStudents);

        const currentMonthTutors = await User.countDocuments({ ...scopedUsers, role: 'tutor', createdAt: { $gte: firstDayCurrentMonth } });
        const lastMonthTutors = await User.countDocuments({ ...scopedUsers, role: 'tutor', createdAt: { $gte: firstDayLastMonth, $lte: lastDayLastMonth } });
        const tutorsTrend = calculateTrend(currentMonthTutors, lastMonthTutors);

        const currentMonthCourses = await Course.countDocuments({ ...scopedCourses, createdAt: { $gte: firstDayCurrentMonth } });
        const lastMonthCourses = await Course.countDocuments({ ...scopedCourses, createdAt: { $gte: firstDayLastMonth, $lte: lastDayLastMonth } });
        const coursesTrend = calculateTrend(currentMonthCourses, lastMonthCourses);

        const trends = {
            students: studentsTrend,
            tutors: tutorsTrend,
            courses: coursesTrend,
            batches: null // 'Running' badge
        };

        // ============================================
        // 3. FEE COLLECTION (Using Payment & Enrollment Models)
        // ============================================
        const Payment = (await import('../models/Payment.js')).default;
        
        // Total Revenue ever (For reference)
        const allPayments = await Payment.find({ instituteId, status: 'paid' });
        const totalRevenue = allPayments.reduce((sum, p) => sum + p.amount, 0);

        // This Month Collection
        const thisMonthPayments = await Payment.find({ instituteId, status: 'paid', paidAt: { $gte: firstDayCurrentMonth } });
        const collectedThisMonth = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);

        // Total Pending Fees
        const pendingPayments = await Payment.find({ instituteId, status: { $in: ['created', 'failed'] } });
        const pendingFees = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

        const expectedThisMonth = collectedThisMonth + pendingFees;
        const feePercentage = expectedThisMonth > 0 ? Math.round((collectedThisMonth / expectedThisMonth) * 100) : 100;

        const feeCollection = {
            thisMonth: expectedThisMonth,
            pending: pendingFees,
            collected: collectedThisMonth,
            percentage: feePercentage
        };

        // ============================================
        // 4. PENDING APPROVALS
        // ============================================
        const pendingInstructors = await Tutor.countDocuments({ instituteId, isVerified: false });
        const pendingStudents = await User.countDocuments({ instituteId, role: 'student', isVerified: false });
        const pendingCourses = await Course.countDocuments({ instituteId, status: 'draft' });

        const pendingApprovals = {
            instructors: pendingInstructors,
            students: pendingStudents,
            courses: pendingCourses
        };

        // ============================================
        // 5. UPCOMING CLASSES (Using LiveClass Model)
        // ============================================
        const LiveClass = (await import('../models/LiveClass.js')).default;
        const upcomingClassesData = await LiveClass.find({ instituteId, dateTime: { $gte: now }, status: { $in: ['scheduled', 'live'] } })
            .sort({ dateTime: 1 })
            .limit(3)
            .populate('courseId', 'title')
            .lean();

        const upcomingClasses = upcomingClassesData.map(cls => {
            const dateObj = new Date(cls.dateTime);
            return {
                title: cls.title,
                date: dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                time: dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                status: cls.status === 'live' ? 'Live' : ''
            };
        });

        // ============================================
        // 6. BATCH OVERVIEW (Using Batch Model)
        // ============================================
        const batchesData = await Batch.find({ instituteId })
            .sort({ createdAt: -1 })
            .limit(4)
            .populate('courseId', 'title')
            .lean();

        const batchOverview = await Promise.all(batchesData.map(async (batch) => {
            const totalDuration = new Date(batch.endDate || now) - new Date(batch.startDate);
            const elapsed = now - new Date(batch.startDate);
            let progress = totalDuration > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100))) : 0;
            
            if (batch.status === 'upcoming') progress = 0;
            if (batch.status === 'completed') progress = 100;

            return {
                name: batch.name,
                students: batch.students ? batch.students.length : 0,
                progress: progress,
                status: batch.status.charAt(0).toUpperCase() + batch.status.slice(1)
            };
        }));

        // ============================================
        // 7. RECENT ACTIVITY
        // ============================================
        const recentNewUsers = await User.find(scopedUsers).sort({ createdAt: -1 }).limit(2);
        const recentPayments = await Payment.find({ instituteId, status: 'paid' }).sort({ createdAt: -1 }).limit(2).populate('studentId', 'name');
        
        let recentActivityRaw = [];
        recentNewUsers.forEach(u => recentActivityRaw.push({ text: `New ${u.role} registered: ${u.name}`, time: u.createdAt, icon: "user", color: "#6854F3" }));
        recentPayments.forEach(p => recentActivityRaw.push({ text: `Payment received: ₹${p.amount} from ${p.studentId?.name || 'Student'}`, time: p.createdAt, icon: "payment", color: "#4F7BF0" }));

        recentActivityRaw.sort((a, b) => b.time - a.time);
        const recentActivity = recentActivityRaw.slice(0, 4).map(act => {
            const diffMins = Math.floor((now - new Date(act.time)) / 60000);
            let timeStr = 'Just now';
            if (diffMins > 0) {
                if (diffMins < 60) timeStr = `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
                else if (diffMins < 1440) timeStr = `${Math.floor(diffMins / 60)} hr${Math.floor(diffMins / 60) !== 1 ? 's' : ''} ago`;
                else timeStr = `${Math.floor(diffMins / 1440)} day${Math.floor(diffMins / 1440) !== 1 ? 's' : ''} ago`;
            }
            return { ...act, time: timeStr };
        });

        // ============================================
        // 8. MONTHLY DATA (For Graph)
        // ============================================
        const monthlyData = Array.from({ length: 4 }, (_, i) => { 
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - (28 - i * 7));
            const weekEnd = new Date();
            weekEnd.setDate(weekEnd.getDate() - (21 - i * 7));
            return { name: `Week ${i+1}`, enrollments: 0, completions: 0, revenue: 0, start: weekStart, end: weekEnd };
        });

        for (const week of monthlyData) {
            const weekEnrs = await Enrollment.countDocuments({ courseId: { $in: instituteCourseIds }, createdAt: { $gte: week.start, $lt: week.end } });
            const weekRev = await Payment.find({ instituteId, status: 'paid', paidAt: { $gte: week.start, $lt: week.end } }).then(pays => pays.reduce((s,p) => s+p.amount, 0));
            week.enrollments = weekEnrs;
            week.revenue = weekRev;
            week.completions = Math.floor(weekEnrs * 0.7); 
        }

        const finalMonthlyData = monthlyData.map(({name, enrollments, completions, revenue}) => ({name, enrollments, completions, revenue}));

        // ============================================
        // 9. UPCOMING EXAMS (NEW ADDITION)
        // ============================================
        const { Exam } = await import('../models/Exam.js'); // Import Exam model dynamically
        
        // Find exams scheduled in the future or active exams that haven't ended
        const upcomingExamsData = await Exam.find({ 
            instituteId, 
            status: 'published',
            $or: [
                { startDate: { $gte: now } },
                { startDate: { $lte: now }, endDate: { $gte: now } },
                { isScheduled: false } // Include anytime exams
            ]
        })
        .sort({ startDate: 1 })
        .limit(3)
        .lean();

        const upcomingExams = upcomingExamsData.map(exam => {
            const dateObj = exam.startDate ? new Date(exam.startDate) : new Date();
            return {
                title: exam.title,
                date: exam.startDate ? dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Flexible',
                time: exam.startDate ? dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Anytime'
            };
        });

        const adminUser = await User.findById(req.user.id);

        res.status(200).json({
            success: true,
            stats: {
                adminName: adminUser?.name || 'Admin',
                adminImage: adminUser?.profileImage || null,
                totalTutors,
                totalStudents,
                totalCourses,
                activeBatches,
                totalRevenue,
                trends,
                monthlyData: finalMonthlyData,
                pendingApprovals,
                feeCollection,
                upcomingClasses,
                recentActivity,
                batchOverview,
                upcomingExams // <-- Now sending Real Upcoming Exams to Frontend!
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
        const users = await User.find(userScope(req, { role: 'tutor' }))
            .select('-password')
            .sort({ createdAt: -1 })
            .lean(); // Lean for mutability

        // Also fetch their corresponding Tutor profiles to get `isVerified` and `tutor._id`
        const userIds = users.map(u => u._id);
        const tutorsProfiles = await Tutor.find({ userId: { $in: userIds } }).lean();

        // Merge User doc with Tutor profile doc
        const detailedTutors = users.map(user => {
            const profile = tutorsProfiles.find(t => t.userId.toString() === user._id.toString());
            return {
                ...user,
                tutorId: profile ? profile._id : null,
                isVerified: profile ? profile.isVerified : false,
                rating: profile ? profile.rating : 0
            };
        });

        const stats = {
            total: detailedTutors.length,
            active: detailedTutors.filter(t => !t.isBlocked && t.isVerified).length,
            inactive: detailedTutors.filter(t => t.isBlocked).length,
            pending: detailedTutors.filter(t => !t.isVerified && !t.isBlocked).length
        };

        res.status(200).json({ success: true, count: detailedTutors.length, stats, tutors: detailedTutors });
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
        const students = await User.find(userScope(req, { role: 'student' }))
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();

        // Stats calculations
        const stats = {
            total: students.length,
            active: students.filter(s => !s.isBlocked && s.isVerified !== false).length,
            inactive: students.filter(s => s.isBlocked).length,
            pending: students.filter(s => s.isVerified === false).length,
        };

        // Fetch recent enrollments as activities
        const Enrollment = (await import('../models/Enrollment.js')).default;
        const recentActivitiesRaw = await Enrollment.find({ status: 'active' })
            .sort({ enrolledAt: -1 })
            .limit(10)
            .populate('studentId', 'name profileImage')
            .populate('courseId', 'title')
            .lean();
        
        const recentActivities = recentActivitiesRaw
            .filter(enr => enr.studentId) // ensure user wasn't deleted
            .slice(0, 3)
            .map(enr => ({
                id: enr._id,
                studentName: enr.studentId?.name || 'Unknown Student',
                image: enr.studentId?.profileImage || null,
                courseTitle: enr.courseId?.title || 'a course',
                time: enr.enrolledAt || enr.createdAt
            }));

        res.status(200).json({ 
            success: true, 
            count: students.length, 
            students,
            stats,
            recentActivities,
            notifications: [
                { type: 'pending', count: stats.pending, text: `${stats.pending} students pending verification` }
            ].filter(n => n.count > 0)
        });
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
        const courses = await Course.find(courseScope(req))
            .populate('tutorId', 'name email')
            .sort({ createdAt: -1 });

        const stats = {
            total: courses.length,
            published: courses.filter(c => c.status === 'published').length,
            draft: courses.filter(c => c.status === 'draft' || c.status === 'pending').length,
            inactive: courses.filter(c => c.status === 'suspended' || c.status === 'rejected').length,
            pending: courses.filter(c => c.status === 'pending').length,
        };

        const recentActivities = courses.slice(0, 3).map(course => ({
            id: course._id,
            title: course.title,
            action: course.status === 'published' ? 'published' : 'created',
            time: course.createdAt
        }));

        res.status(200).json({ 
            success: true, 
            count: courses.length, 
            courses,
            stats,
            recentActivities
        });
    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Create course as admin
// @route   POST /api/admin/courses
// @access  Private (Admin)
export const createAdminCourse = async (req, res) => {
    try {
        const {
            title, description, thumbnail, categoryId, tutorId,
            price, level, duration, language, modules,
            requirements, whatYouWillLearn, status, ...rest
        } = req.body;

        if (!title || !description || !categoryId) {
            return res.status(400).json({ success: false, message: 'Title, description, and category are required' });
        }

        const course = await Course.create({
            title,
            description,
            thumbnail,
            categoryId,
            tutorId: tutorId || null,
            instituteId: getAdminInstituteId(req),
            createdBy: req.user.id,
            status: status || 'published', 
            price: price || 0,
            level: level || 'beginner',
            duration: duration || 0,
            language: language || 'English',
            modules: modules || [],
            requirements: requirements || [],
            whatYouWillLearn: whatYouWillLearn || [],
            visibility: 'institute',
            audience: { scope: 'institute', instituteId: getAdminInstituteId(req) },
            ...rest
        });

        res.status(201).json({ success: true, message: 'Course created successfully', course });
    } catch (error) {
        console.error('Create admin course error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Update course as admin
// @route   PUT /api/admin/courses/:id
// @access  Private (Admin)
export const updateAdminCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const course = await Course.findOne({ _id: id, instituteId: getAdminInstituteId(req) });

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        // Apply updates
        Object.keys(updates).forEach(key => {
            course[key] = updates[key];
        });

        await course.save();

        res.status(200).json({ success: true, message: 'Course updated successfully', course });
    } catch (error) {
        console.error('Update admin course error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
export const deleteUser = async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.params.id, instituteId: getAdminInstituteId(req) });

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

// @desc    Create a new user manually
// @route   POST /api/admin/users
// @access  Private (Admin)
export const createUser = async (req, res) => {
    try {
        const { 
            name, email, password, phone, role,
            dob, gender, alternatePhone, studentSmartphoneNo,
            assignedBranch, parentDetails, address, profileImage,
            website, subjects
        } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ success: false, message: 'Please provide all required fields' });
        }

        if (!['student', 'tutor', 'admin'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }

        if (role === 'superadmin') {
            return res.status(403).json({ success: false, message: 'Cannot create superadmin' });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            role,
            dob: dob || null,
            gender: gender || null,
            alternatePhone: alternatePhone || '',
            studentSmartphoneNo: studentSmartphoneNo || '',
            assignedBranch: assignedBranch || null,
            parentDetails: parentDetails || [],
            address: address || {},
            ...(profileImage && { profileImage }),
            instituteId: getAdminInstituteId(req)
        });

        if (role === 'tutor') {
            const settings = (await Settings.findOne()) || {};
            await Tutor.create({
                userId: user._id,
                isVerified: settings.autoApproveTutors || false,
                website: website || '',
                subjects: subjects || []
            });
        }

        res.status(201).json({
            success: true,
            user: { _id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Update user details
// @route   PUT /api/admin/users/:id
// @access  Private (Admin)
export const updateUser = async (req, res) => {
    try {
        const user = await User.findOne({ _id: req.params.id, instituteId: getAdminInstituteId(req) });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const { 
            name, email, phone, role,
            dob, gender, alternatePhone, studentSmartphoneNo,
            assignedBranch, parentDetails, address, profileImage,
            website, subjects
        } = req.body;

        if (name !== undefined) user.name = name;
        if (email !== undefined) user.email = email;
        if (phone !== undefined) user.phone = phone;
        if (role && ['student', 'tutor', 'admin'].includes(role)) user.role = role;
        
        if (dob !== undefined) user.dob = dob;
        if (gender !== undefined) user.gender = gender;
        if (alternatePhone !== undefined) user.alternatePhone = alternatePhone;
        if (studentSmartphoneNo !== undefined) user.studentSmartphoneNo = studentSmartphoneNo;
        if (assignedBranch !== undefined) user.assignedBranch = assignedBranch;
        if (parentDetails !== undefined) user.parentDetails = parentDetails;
        if (address !== undefined) user.address = address;
        if (profileImage !== undefined) user.profileImage = profileImage;

        const updatedUser = await user.save();

        if (updatedUser.role === 'tutor') {
            const tutorUpdates = {};
            if (website !== undefined) tutorUpdates.website = website;
            if (subjects !== undefined) tutorUpdates.subjects = subjects;

            const existingTutorProfile = await Tutor.findOne({ userId: updatedUser._id });
            if (!existingTutorProfile) {
                const settings = (await Settings.findOne()) || {};
                await Tutor.create({
                    userId: updatedUser._id,
                    isVerified: settings.autoApproveTutors || false,
                    ...tutorUpdates
                });
            } else if (Object.keys(tutorUpdates).length > 0) {
                await Tutor.updateOne({ userId: updatedUser._id }, { $set: tutorUpdates });
            }
        }

        res.status(200).json({
            success: true,
            user: { _id: updatedUser._id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role }
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Block or User Status update
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin)
export const updateUserStatus = async (req, res) => {
    try {
        const { isBlocked } = req.body;
        const user = await User.findOne({ _id: req.params.id, instituteId: getAdminInstituteId(req) });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Prevent admin from blocking themselves
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({ success: false, message: 'You cannot block yourself' });
        }

        user.isBlocked = isBlocked;
        await user.save();

        res.status(200).json({
            success: true,
            message: `User has been ${isBlocked ? 'blocked' : 'unblocked'} successfully`
        });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Update course status (Approve/Suspend)
// @route   PUT /api/admin/courses/:id/status
// @access  Private (Admin)
export const updateCourseStatus = async (req, res) => {
    try {
        const { status } = req.body; // e.g., 'published', 'rejected', 'suspended'
        const course = await Course.findOne({ _id: req.params.id, instituteId: getAdminInstituteId(req) });

        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        course.status = status;
        await course.save();

        res.status(200).json({
            success: true,
            message: `Course status updated to ${status} successfully`
        });
    } catch (error) {
        console.error('Update course status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Delete course
// @route   DELETE /api/admin/courses/:id
// @access  Private (Admin)
export const deleteCourse = async (req, res) => {
    try {
        const course = await Course.findOne({ _id: req.params.id, instituteId: getAdminInstituteId(req) });

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
        const instituteId = getAdminInstituteId(req);
        // 1. User Growth (Last 6 months) - Aggregation
        // Note: In production, consider using a proper timeseries db or more optimized query
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const userGrowth = await User.aggregate([
            { $match: { instituteId, createdAt: { $gte: sixMonthsAgo } } },
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
            { $match: { instituteId } },
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
            { $match: { instituteId } },
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
        const instituteCourseIds = (await Course.find(courseScope(req)).select('_id')).map(c => c._id);
        const enrollments = await Enrollment.find({ status: 'active' })
            .where('courseId').in(instituteCourseIds)
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

        const recentUsers = await User.find(userScope(req)).sort({ createdAt: -1 }).limit(5).select('name role createdAt');
        const recentCourses = await Course.find(courseScope(req)).sort({ createdAt: -1 }).limit(5).select('title tutorId createdAt');

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
        const tutor = await User.findOne({
            _id: req.params.id,
            instituteId: getAdminInstituteId(req)
        }).select('-password');
        if (!tutor || tutor.role !== 'tutor') {
            return res.status(404).json({ success: false, message: 'Tutor not found' });
        }

        const tutorProfile = await Tutor.findOne({ userId: tutor._id }).select('_id isVerified');

        const courses = tutorProfile
            ? await Course.find({
                tutorId: tutorProfile._id,
                instituteId: getAdminInstituteId(req)
            })
            : [];

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
            tutor: {
                ...tutor.toObject(),
                isVerified: tutorProfile?.isVerified || false,
                tutorId: tutorProfile?._id || null
            },
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

// @desc    Verify or Unverify Tutor Profile
// @route   PUT /api/admin/tutors/:id/verify
// @access  Private (Admin)
export const verifyTutor = async (req, res) => {
    try {
        const { id } = req.params;
        const { isVerified } = req.body;

        const tutor = await Tutor.findById(id).populate('userId', 'instituteId');
        if (!tutor) {
            return res.status(404).json({ success: false, message: 'Tutor not found' });
        }

        if (!tutor.userId || String(tutor.userId.instituteId || '') !== String(getAdminInstituteId(req))) {
            return res.status(403).json({ success: false, message: 'Not authorized to verify this tutor' });
        }

        tutor.isVerified = isVerified;
        await tutor.save();

        res.status(200).json({
            success: true,
            message: `Tutor profile ${isVerified ? 'verified' : 'unverified'} successfully`,
            tutor
        });
    } catch (error) {
        console.error('Verify tutor error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get Student Details
// @route   GET /api/admin/students/:id
// @access  Private (Admin)
export const getStudentDetails = async (req, res) => {
    try {
        const student = await User.findOne({
            _id: req.params.id,
            instituteId: getAdminInstituteId(req)
        }).select('-password');
        if (!student || student.role !== 'student') {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        const instituteCourseIds = (await Course.find(courseScope(req)).select('_id')).map(c => c._id);
        const enrollments = await Enrollment.find({
            studentId: student._id,
            courseId: { $in: instituteCourseIds }
        })
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
        const course = await Course.findOne({
            _id: req.params.id,
            instituteId: getAdminInstituteId(req)
        }).populate('tutorId', 'name email profileImage');
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

// @desc    Get Platform Settings
// @route   GET /api/admin/settings
// @access  Private (Admin)
export const getSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();

        // Ensure default settings exist if first time
        if (!settings) {
            settings = await Settings.create({});
        }

        res.status(200).json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Update Platform Settings
// @route   PUT /api/admin/settings
// @access  Private (Admin)
export const updateSettings = async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            settings = await Settings.create({});
        }

        // All updatable fields from Settings model
        const updatableFields = [
            'siteName', 'supportEmail', 'defaultLanguage',
            'allowRegistration', 'autoApproveCourses', 'autoApproveTutors',
            'allowGuestBrowsing', 'platformCommission', 'supportPhone',
            'facebookLink', 'twitterLink', 'primaryColor', 'footerText',
            'contactEmail', 'contactAddress', 'favicon', 'googleAnalyticsId',
            'metaPixelId', 'instagramLink', 'linkedinLink', 'youtubeLink',
            // Theme settings
            'secondaryColor', 'accentColor', 'fontFamily', 'fontSize',
            'allowInstituteBranding', 'enforceGlobalTheme', 'enableDarkMode'
        ];

        updatableFields.forEach(field => {
            if (req.body[field] !== undefined) {
                settings[field] = req.body[field];
            }
        });

        settings.updatedAt = Date.now();
        await settings.save();

        res.status(200).json({
            success: true,
            message: 'Settings updated successfully',
            settings
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Create Institute (Super Admin only)
// @route   POST /api/admin/institutes
// @access  Private (Super Admin)
export const createInstitute = async (req, res) => {
    try {
        const { name, subdomain, description, adminEmail, adminName, adminPhone } = req.body;

        // Validate required fields
        if (!name || !subdomain || !adminEmail || !adminName) {
            return res.status(400).json({
                success: false,
                message: 'Name, subdomain, admin email, and admin name are required'
            });
        }

        // Check if subdomain already exists
        const existingSubdomain = await Institute.findOne({ subdomain });
        if (existingSubdomain) {
            return res.status(400).json({
                success: false,
                message: 'Subdomain already exists'
            });
        }

        // Check if admin email already exists
        const existingAdmin = await User.findOne({ email: adminEmail });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'Admin email already exists'
            });
        }

        // Create institute
        const institute = await Institute.create({
            name,
            subdomain,
            description,
            isActive: true,
            subscriptionPlan: 'premium', // Default for new institutes
            settings: {
                allowStudentRegistration: true,
                requireInviteForStudents: false,
                requireInviteForTutors: true,
                autoApproveStudents: true,
                autoApproveTutors: false
            }
        });

        // Create admin user
        const hashedPassword = await bcrypt.hash('admin123', 10); // Default password
        const adminUser = await User.create({
            name: adminName,
            email: adminEmail,
            phone: adminPhone || '',
            password: hashedPassword,
            role: 'admin',
            instituteId: institute._id
        });

        // Create admin membership
        await InstituteMembership.create({
            userId: adminUser._id,
            instituteId: institute._id,
            roleInInstitute: 'admin',
            status: 'active',
            joinedVia: 'system_created',
            approvedBy: adminUser._id,
            approvedAt: new Date(),
            permissions: {
                canCreateCourses: true,
                canCreateExams: true,
                canViewAnalytics: true,
                canManageStudents: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Institute created successfully',
            institute,
            admin: {
                _id: adminUser._id,
                name: adminUser.name,
                email: adminUser.email,
                role: adminUser.role,
                defaultPassword: 'admin123' // Send to admin via email
            }
        });
    } catch (error) {
        console.error('Create institute error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get All Institutes (Super Admin only)
// @route   GET /api/admin/institutes
// @access  Private (Super Admin)
export const getAllInstitutes = async (req, res) => {
    try {
        const institutes = await Institute.find()
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            institutes
        });
    } catch (error) {
        console.error('Get institutes error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Remove User from Institute
// @route   DELETE /api/admin/users/:id/remove-from-institute
// @access  Private (Admin)
export const removeUserFromInstitute = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const adminInstituteId = getAdminInstituteId(req);

        // Find the user to remove
        const user = await User.findById(id);
        if (!user) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if user belongs to admin's institute
        if (user.instituteId?.toString() !== adminInstituteId?.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json({ success: false, message: 'User does not belong to your institute' });
        }

        // Remove institute membership if exists
        await InstituteMembership.deleteMany({
            userId: id,
            instituteId: adminInstituteId
        }, { session });

        // Remove user's institute association
        await User.findByIdAndUpdate(id, {
            $unset: { instituteId: 1 }
        }, { session });

        // If user is a tutor, remove tutor profile
        if (user.role === 'tutor') {
            await Tutor.deleteOne({ userId: id }, { session });
        }

        // Remove all enrollments for this user in this institute
        await Enrollment.deleteMany({
            studentId: id,
            instituteId: adminInstituteId
        }, { session });

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: `${user.name} removed from institute successfully`
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Remove user from institute error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get all Admin Fees
// @route   GET /api/admin/fees
// @access  Private (Admin)
export const getAdminFees = async (req, res) => {
    try {
        const instituteId = getAdminInstituteId(req);
        const Payment = (await import('../models/Payment.js')).default;
        
        // Fetch all institute_fee payments
        const fees = await Payment.find({ instituteId, type: 'institute_fee' })
            .populate('studentId', 'name email profileImage')
            .sort({ createdAt: -1 });
            
        res.status(200).json({
            success: true,
            fees
        });
    } catch (error) {
        console.error('Error fetching admin fees:', error);
        res.status(500).json({ success: false, message: 'Server error fetching fees' });
    }
};

// @desc    Issue a new Fee to a student or batch
// @route   POST /api/admin/fees/issue
// @access  Private (Admin)
export const issueStudentFee = async (req, res) => {
    try {
        const instituteId = getAdminInstituteId(req);
        const Payment = (await import('../models/Payment.js')).default;
        const User = (await import('../models/User.js')).default;
        const { targetType, targetId, title, amount, dueDate, description } = req.body;
        
        if (!title || !amount) {
            return res.status(400).json({ success: false, message: 'Title and Amount are required' });
        }

        const feesToCreate = [];

        if (targetType === 'student') {
            feesToCreate.push({
                studentId: targetId,
                instituteId,
                type: 'institute_fee',
                title,
                amount: Number(amount),
                dueDate: dueDate ? new Date(dueDate) : null,
                status: 'created',
                razorpayOrderId: `pending_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            });
        } else if (targetType === 'batch') {
            const Batch = (await import('../models/Batch.js')).default;
            const batch = await Batch.findById(targetId);
            if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
            
            for (const studentId of batch.students) {
                feesToCreate.push({
                    studentId,
                    instituteId,
                    type: 'institute_fee',
                    title,
                    amount: Number(amount),
                    dueDate: dueDate ? new Date(dueDate) : null,
                    status: 'created',
                    razorpayOrderId: `pending_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                });
            }
        }

        if (feesToCreate.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid students found to issue fee' });
        }

        await Payment.insertMany(feesToCreate);

        res.status(201).json({
            success: true,
            message: `Successfully issued fee to ${feesToCreate.length} student(s)`
        });

    } catch (error) {
        console.error('Error issuing fee:', error);
        res.status(500).json({ success: false, message: 'Server error issuing fee' });
    }
};
