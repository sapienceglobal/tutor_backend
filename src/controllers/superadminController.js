import Institute from '../models/Institute.js';
import User from '../models/User.js';
import InstituteMembership from '../models/InstituteMembership.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Payment from '../models/Payment.js';
import Tutor from '../models/Tutor.js';
import Certificate from '../models/Certificate.js';
import AuditLog from '../models/AuditLog.js';
import PayoutRequest from '../models/PayoutRequest.js';

const ANALYTICS_RANGE_WEEKS = {
    '5w': 5,
    '8w': 8,
    '12w': 12
};

const COURSES_RANGE_DAYS = {
    month: 30,
    year: 365
};

const normalizeAnalyticsRange = (value) => (ANALYTICS_RANGE_WEEKS[value] ? value : '5w');
const normalizeCoursesRange = (value) => (COURSES_RANGE_DAYS[value] ? value : 'year');

const startOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

const endOfDay = (date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};

const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};

const percentageGrowth = (current, previous) => {
    if (!previous) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
};

const toNumberMap = (rows, keyField = '_id', valueField = 'count') => {
    const map = new Map();
    rows.forEach((row) => {
        const key = row?.[keyField];
        if (key) map.set(String(key), Number(row?.[valueField] || 0));
    });
    return map;
};

const buildWeeklyBuckets = (weeks, now = new Date()) => {
    const buckets = [];
    const totalDays = weeks * 7;
    const firstDay = startOfDay(addDays(now, -(totalDays - 1)));

    for (let i = 0; i < weeks; i++) {
        const start = startOfDay(addDays(firstDay, i * 7));
        const end = endOfDay(addDays(start, 6));
        buckets.push({
            key: `week-${i + 1}`,
            name: `Week ${i + 1}`,
            start,
            end
        });
    }

    return buckets;
};


// 1. Get All Institutes

export const getInstitutes = async (req, res) => {
    try {
        const institutes = await Institute.find().sort({ createdAt: -1 });

        const institutesWithStats = await Promise.all(institutes.map(async (inst) => {
            // 🌟 NAYA LOGIC: Tutors, Students aur Total Users ka alag-alag count nikalo
            const [userCount, tutorsCount, studentsCount] = await Promise.all([
                User.countDocuments({ instituteId: inst._id }),
                User.countDocuments({ instituteId: inst._id, role: 'tutor' }),
                User.countDocuments({ instituteId: inst._id, role: 'student' })
            ]);

            // 🌟 LEGACY PLAN FIX: String ko capitalize kar do
            let formattedPlan = inst.subscriptionPlan || 'No Plan';
            if (formattedPlan && typeof formattedPlan === 'string') {
                formattedPlan = formattedPlan.charAt(0).toUpperCase() + formattedPlan.slice(1);
            }

            return {
                ...inst.toObject(),
                subscriptionPlan: formattedPlan,
                userCount,
                tutorsCount,      // Ab ye frontend me direct dikhega
                studentsCount     // Ab sirf actual students ka count aayega
            };
        }));

        res.json({ success: true, institutes: institutesWithStats });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch institutes' });
    }
};

// 2. Create New Institute & Default Admin
export const createInstitute = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 'plan' field received from frontend is now actually the 'planId'
        const { name, subdomain, adminName, adminEmail, adminPassword, planId } = req.body;

        // Check if subdomain exists
        const existingInst = await Institute.findOne({ subdomain: subdomain.toLowerCase() }).session(session);
        if (existingInst) {
            return res.status(400).json({ success: false, message: 'Subdomain already in use.' });
        }

        // Check if admin email exists globally
        const existingAdmin = await User.findOne({ email: adminEmail }).session(session);
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: 'Admin email already registered.' });
        }

        // 🌟 DYNAMIC PLAN FETCHING
        let planName = 'Custom';
        let planFeatures = {
            hlsStreaming: false,
            customBranding: false,
            zoomIntegration: false,
            aiFeatures: false,
            apiAccess: false
        };

        if (planId) {
            const selectedPlan = await SubscriptionPlan.findById(planId).session(session);
            if (selectedPlan) {
                planName = selectedPlan.name;
                planFeatures = {
                    hlsStreaming: selectedPlan.features.hlsStreaming,
                    customBranding: selectedPlan.features.customBranding,
                    zoomIntegration: selectedPlan.features.zoomIntegration,
                    aiFeatures: selectedPlan.features.aiBasic,
                    apiAccess: selectedPlan.features.apiAccess || false
                };
            }
        }

        const newInstitute = new Institute({
            name,
            subdomain: subdomain.toLowerCase(),
            subscriptionPlan: planName, // Saving the real string name ("Platinum", "Pro", etc.)
            features: planFeatures
        });

        await newInstitute.save({ session });

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        const newAdmin = new User({
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            instituteId: newInstitute._id
        });

        await newAdmin.save({ session });

        // Create InstituteMembership for admin
        await InstituteMembership.create([{
            userId: newAdmin._id,
            instituteId: newInstitute._id,
            roleInInstitute: 'admin',
            status: 'active',
            joinedVia: 'system_created',
            approvedBy: newAdmin._id,
            approvedAt: new Date(),
            permissions: {
                canCreateCourses: true,
                canCreateExams: true,
                canViewAnalytics: true,
                canManageStudents: true
            }
        }], { session });

        await session.commitTransaction();
        session.endSession();

        // Send credentials email to the new admin
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS,
                },
            });

            await transporter.sendMail({
                from: `"Sapience LMS" <${process.env.EMAIL_USER}>`,
                to: adminEmail,
                subject: `Welcome to ${name} — Your Admin Credentials`,
                html: `
                    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 30px;">
                        <h2 style="color: #4f46e5;">Welcome to Sapience LMS! 🎓</h2>
                        <p>An institute <strong>${name}</strong> has been created and you have been assigned as the Admin.</p>
                        <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0;">
                            <p style="margin: 5px 0;"><strong>Login URL:</strong> <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login">${process.env.FRONTEND_URL || 'http://localhost:3000'}/login</a></p>
                            <p style="margin: 5px 0;"><strong>Email:</strong> ${adminEmail}</p>
                            <p style="margin: 5px 0;"><strong>Password:</strong> ${adminPassword}</p>
                        </div>
                        <p style="color: #64748b; font-size: 13px;">Please change your password after first login.</p>
                    </div>
                `,
            });
        } catch (emailErr) {
            console.error('Failed to send admin credentials email:', emailErr.message);
        }

        res.status(201).json({ success: true, institute: newInstitute, message: 'Institute and Admin created successfully. Credentials emailed.' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(error);
        res.status(500).json({ success: false, message: error.message || 'Server error creating institute' });
    }
};

// 3. Update Institute Status or Features
export const updateInstitute = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const institute = await Institute.findByIdAndUpdate(id, updates, { new: true });

        if (!institute) {
            return res.status(404).json({ success: false, message: 'Institute not found.' });
        }

        res.json({ success: true, institute, message: 'Institute updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update institute' });
    }
};

// 4. Get Platform Overview Stats
export const getPlatformStats = async (req, res) => {
    const requestStartedAt = Date.now();

    try {
        const now = new Date();
        const analyticsRange = normalizeAnalyticsRange(req.query.analyticsRange);
        const coursesRange = normalizeCoursesRange(req.query.coursesRange);
        const analyticsWeeks = ANALYTICS_RANGE_WEEKS[analyticsRange];
        const coursesRangeStart = addDays(startOfDay(now), -(COURSES_RANGE_DAYS[coursesRange] - 1));

        const [
            totalInstitutes,
            activeInstitutes,
            totalUsers,
            totalTutors,
            totalStudents,
            totalCourses
        ] = await Promise.all([
            Institute.countDocuments(),
            Institute.countDocuments({ isActive: true }),
            User.countDocuments({ role: { $ne: 'superadmin' } }),
            User.countDocuments({ role: 'tutor' }),
            User.countDocuments({ role: 'student' }),
            Course.countDocuments()
        ]);

        const currentWindowStart = addDays(startOfDay(now), -29);
        const previousWindowStart = addDays(currentWindowStart, -30);

        const [
            currentStudents,
            previousStudents,
            currentTutors,
            previousTutors,
            currentInstitutes,
            previousInstitutes,
            currentCourses,
            previousCourses
        ] = await Promise.all([
            User.countDocuments({ role: 'student', createdAt: { $gte: currentWindowStart } }),
            User.countDocuments({ role: 'student', createdAt: { $gte: previousWindowStart, $lt: currentWindowStart } }),
            User.countDocuments({ role: 'tutor', createdAt: { $gte: currentWindowStart } }),
            User.countDocuments({ role: 'tutor', createdAt: { $gte: previousWindowStart, $lt: currentWindowStart } }),
            Institute.countDocuments({ createdAt: { $gte: currentWindowStart } }),
            Institute.countDocuments({ createdAt: { $gte: previousWindowStart, $lt: currentWindowStart } }),
            Course.countDocuments({ createdAt: { $gte: currentWindowStart } }),
            Course.countDocuments({ createdAt: { $gte: previousWindowStart, $lt: currentWindowStart } })
        ]);

        const weeklyBuckets = buildWeeklyBuckets(analyticsWeeks, now);
        const analytics = await Promise.all(weeklyBuckets.map(async (bucket) => {
            const [students, instructors, revenueAgg] = await Promise.all([
                User.countDocuments({ role: 'student', createdAt: { $gte: bucket.start, $lte: bucket.end } }),
                User.countDocuments({ role: 'tutor', createdAt: { $gte: bucket.start, $lte: bucket.end } }),
                Payment.aggregate([
                    { $addFields: { effectiveDate: { $ifNull: ['$paidAt', '$createdAt'] } } },
                    {
                        $match: {
                            status: 'paid',
                            effectiveDate: { $gte: bucket.start, $lte: bucket.end }
                        }
                    },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ])
            ]);

            return {
                name: bucket.name,
                students,
                instructors,
                revenue: Number(revenueAgg?.[0]?.total || 0)
            };
        }));

        const [enrollmentByCourse, revenueByCourse] = await Promise.all([
            Enrollment.aggregate([
                { $match: { enrolledAt: { $gte: coursesRangeStart } } },
                { $group: { _id: '$courseId', students: { $sum: 1 } } }
            ]),
            Payment.aggregate([
                { $addFields: { effectiveDate: { $ifNull: ['$paidAt', '$createdAt'] } } },
                {
                    $match: {
                        status: 'paid',
                        courseId: { $ne: null },
                        effectiveDate: { $gte: coursesRangeStart }
                    }
                },
                { $group: { _id: '$courseId', revenue: { $sum: '$amount' } } }
            ])
        ]);

        const enrollmentMap = toNumberMap(enrollmentByCourse, '_id', 'students');
        const courseRevenueMap = toNumberMap(revenueByCourse, '_id', 'revenue');

        const topCourseIds = Array.from(new Set([
            ...enrollmentMap.keys(),
            ...courseRevenueMap.keys()
        ]));

        const topCourseDocs = topCourseIds.length > 0
            ? await Course.find({ _id: { $in: topCourseIds } }).select('title').lean()
            : [];
        const topCourseDocMap = new Map(topCourseDocs.map((course) => [String(course._id), course]));

        const topCourses = topCourseIds
            .map((courseId) => ({
                id: courseId,
                name: topCourseDocMap.get(courseId)?.title || 'Unknown Course',
                students: Number(enrollmentMap.get(courseId) || 0),
                revenue: Number(courseRevenueMap.get(courseId) || 0)
            }))
            .sort((a, b) => (b.students - a.students) || (b.revenue - a.revenue))
            .slice(0, 5);

        const [studentsByInstitute, directRevenueByInstitute, courseRevenueByInstitute] = await Promise.all([
            InstituteMembership.aggregate([
                { $match: { roleInInstitute: 'student', status: 'active' } },
                { $group: { _id: '$instituteId', students: { $sum: 1 } } }
            ]),
            Payment.aggregate([
                { $match: { status: 'paid', instituteId: { $ne: null } } },
                { $group: { _id: '$instituteId', revenue: { $sum: '$amount' } } }
            ]),
            Payment.aggregate([
                { $match: { status: 'paid', instituteId: null, courseId: { $ne: null } } },
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'courseId',
                        foreignField: '_id',
                        as: 'course'
                    }
                },
                { $unwind: '$course' },
                { $match: { 'course.instituteId': { $ne: null } } },
                { $group: { _id: '$course.instituteId', revenue: { $sum: '$amount' } } }
            ])
        ]);

        const instituteStudentMap = toNumberMap(studentsByInstitute, '_id', 'students');
        const directRevenueMap = toNumberMap(directRevenueByInstitute, '_id', 'revenue');
        const courseInstituteRevenueMap = toNumberMap(courseRevenueByInstitute, '_id', 'revenue');

        const instituteIds = Array.from(new Set([
            ...instituteStudentMap.keys(),
            ...directRevenueMap.keys(),
            ...courseInstituteRevenueMap.keys()
        ]));

        const instituteDocs = instituteIds.length > 0
            ? await Institute.find({ _id: { $in: instituteIds } }).select('name').lean()
            : [];
        const instituteDocMap = new Map(instituteDocs.map((inst) => [String(inst._id), inst]));

        const topInstitutes = instituteIds
            .map((instituteId) => ({
                id: instituteId,
                name: instituteDocMap.get(instituteId)?.name || 'Unknown Institute',
                students: Number(instituteStudentMap.get(instituteId) || 0),
                revenue: Number(directRevenueMap.get(instituteId) || 0) + Number(courseInstituteRevenueMap.get(instituteId) || 0)
            }))
            .sort((a, b) => (b.revenue - a.revenue) || (b.students - a.students))
            .slice(0, 5);

        const [coursesByTutor, revenueByTutor, certificatesByTutorUser, totalCertificatesIssued] = await Promise.all([
            Course.aggregate([
                { $match: { tutorId: { $ne: null } } },
                {
                    $group: {
                        _id: '$tutorId',
                        courseCount: { $sum: 1 },
                        students: { $sum: { $ifNull: ['$enrolledCount', 0] } }
                    }
                }
            ]),
            Payment.aggregate([
                { $match: { status: 'paid', courseId: { $ne: null } } },
                {
                    $lookup: {
                        from: 'courses',
                        localField: 'courseId',
                        foreignField: '_id',
                        as: 'course'
                    }
                },
                { $unwind: '$course' },
                { $match: { 'course.tutorId': { $ne: null } } },
                { $group: { _id: '$course.tutorId', revenue: { $sum: '$amount' } } }
            ]),
            Certificate.aggregate([
                { $match: { tutorId: { $ne: null } } },
                { $group: { _id: '$tutorId', count: { $sum: 1 } } }
            ]),
            Certificate.countDocuments()
        ]);

        const tutorCourseMap = new Map(
            coursesByTutor.map((row) => [String(row._id), {
                courseCount: Number(row.courseCount || 0),
                students: Number(row.students || 0)
            }])
        );
        const tutorRevenueMap = toNumberMap(revenueByTutor, '_id', 'revenue');
        const certificatesByUserMap = toNumberMap(certificatesByTutorUser, '_id', 'count');

        const tutorIds = Array.from(new Set([
            ...tutorCourseMap.keys(),
            ...tutorRevenueMap.keys()
        ]));

        const tutorDocs = tutorIds.length > 0
            ? await Tutor.find({ _id: { $in: tutorIds } })
                .select('userId')
                .populate('userId', 'name profileImage')
                .lean()
            : [];
        const tutorDocMap = new Map(tutorDocs.map((doc) => [String(doc._id), doc]));

        const topInstructors = tutorIds
            .map((tutorId) => {
                const tutorData = tutorCourseMap.get(tutorId) || { courseCount: 0, students: 0 };
                const tutorDoc = tutorDocMap.get(tutorId);
                const userId = tutorDoc?.userId?._id ? String(tutorDoc.userId._id) : null;
                return {
                    id: tutorId,
                    name: tutorDoc?.userId?.name || 'Unknown Instructor',
                    profileImage: tutorDoc?.userId?.profileImage || null,
                    students: Number(tutorData.students || 0),
                    courseCount: Number(tutorData.courseCount || 0),
                    revenue: Number(tutorRevenueMap.get(tutorId) || 0),
                    certificates: userId ? Number(certificatesByUserMap.get(userId) || 0) : 0
                };
            })
            .sort((a, b) => (b.students - a.students) || (b.revenue - a.revenue))
            .slice(0, 5);

        const [recentUsers, recentPayments, recentAudits] = await Promise.all([
            User.find({ role: { $ne: 'superadmin' } })
                .select('name email role createdAt profileImage')
                .sort({ createdAt: -1 })
                .limit(8)
                .lean(),
            Payment.find({ status: 'paid' })
                .select('amount paidAt createdAt studentId')
                .populate('studentId', 'name')
                .sort({ paidAt: -1, createdAt: -1 })
                .limit(8)
                .lean(),
            AuditLog.find()
                .select('action resource path statusCode createdAt userId')
                .populate('userId', 'name')
                .sort({ createdAt: -1 })
                .limit(8)
                .lean()
        ]);

        const userActivities = recentUsers.map((user) => ({
            id: `user-${user._id}`,
            type: 'registration',
            title: user.name || 'New user',
            subtitle: `${user.role || 'user'} registration`,
            value: user.email || '',
            timestamp: user.createdAt
        }));

        const paymentActivities = recentPayments.map((payment) => ({
            id: `payment-${payment._id}`,
            type: 'payment',
            title: payment.studentId?.name || 'Payment received',
            subtitle: 'Paid transaction',
            value: Number(payment.amount || 0),
            timestamp: payment.paidAt || payment.createdAt
        }));

        const auditActivities = recentAudits.map((audit) => ({
            id: `audit-${audit._id}`,
            type: 'audit',
            title: audit.userId?.name || 'System',
            subtitle: audit.action || audit.resource || 'Audit event',
            value: audit.path || '',
            statusCode: audit.statusCode || null,
            timestamp: audit.createdAt
        }));

        const recentActivities = [...userActivities, ...paymentActivities, ...auditActivities]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10);

        const [pendingApprovals, paymentFailures, systemAlerts, highRiskUsers] = await Promise.all([
            InstituteMembership.countDocuments({ status: 'pending' }),
            Payment.countDocuments({ status: 'failed' }),
            AuditLog.countDocuments({ statusCode: { $gte: 500 }, createdAt: { $gte: addDays(now, -7) } }),
            User.countDocuments({ role: { $ne: 'superadmin' }, isBlocked: true })
        ]);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [totalRevenueAgg, monthlyRevenueAgg, activeSubscriptions, pendingPayoutAgg, pendingPaymentsAgg] = await Promise.all([
            Payment.aggregate([
                { $match: { status: 'paid' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Payment.aggregate([
                { $addFields: { effectiveDate: { $ifNull: ['$paidAt', '$createdAt'] } } },
                { $match: { status: 'paid', effectiveDate: { $gte: monthStart } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Institute.countDocuments({
                isActive: true,
                $or: [
                    { subscriptionExpiresAt: null },
                    { subscriptionExpiresAt: { $gte: now } }
                ]
            }),
            PayoutRequest.aggregate([
                { $match: { status: { $in: ['pending', 'processing'] } } },
                { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } }
            ]),
            Payment.aggregate([
                { $match: { status: { $in: ['created', 'failed'] } } },
                { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } }
            ])
        ]);

        const auditsWindowStart = addDays(now, -1);
        const [auditRequests24h, auditErrors24h] = await Promise.all([
            AuditLog.countDocuments({ createdAt: { $gte: auditsWindowStart } }),
            AuditLog.countDocuments({ createdAt: { $gte: auditsWindowStart }, statusCode: { $gte: 500 } })
        ]);

        const auditErrorRate24h = auditRequests24h > 0
            ? Number(((auditErrors24h / auditRequests24h) * 100).toFixed(2))
            : 0;
        const serverStatus = auditErrorRate24h > 20
            ? 'critical'
            : auditErrorRate24h > 5
                ? 'degraded'
                : 'healthy';
        const handlerLatencyMs = Date.now() - requestStartedAt;

        res.json({
            success: true,
            stats: {
                totalInstitutes,
                activeInstitutes,
                totalUsers,
                totalTutors,
                totalStudents,
                totalCourses
            },
            dashboard: {
                filters: {
                    analyticsRange,
                    coursesRange
                },
                kpiGrowth: {
                    institutes: percentageGrowth(currentInstitutes, previousInstitutes),
                    students: percentageGrowth(currentStudents, previousStudents),
                    tutors: percentageGrowth(currentTutors, previousTutors),
                    courses: percentageGrowth(currentCourses, previousCourses)
                },
                analytics,
                topCourses,
                topInstitutes,
                topInstructors,
                recentActivities,
                alerts: {
                    pendingApprovals,
                    paymentFailures,
                    systemAlerts,
                    highRiskUsers
                },
                certificates: {
                    totalIssued: Number(totalCertificatesIssued || 0)
                },
                revenueOverview: {
                    totalRevenue: Number(totalRevenueAgg?.[0]?.total || 0),
                    monthlyRevenue: Number(monthlyRevenueAgg?.[0]?.total || 0),
                    activeSubscriptions: Number(activeSubscriptions || 0),
                    payoutPendingAmount: Number(pendingPayoutAgg?.[0]?.totalAmount || 0),
                    payoutPendingCount: Number(pendingPayoutAgg?.[0]?.count || 0),
                    pendingPaymentsAmount: Number(pendingPaymentsAgg?.[0]?.totalAmount || 0),
                    pendingPaymentsCount: Number(pendingPaymentsAgg?.[0]?.count || 0)
                },
                diagnostics: {
                    serverStatus,
                    handlerLatencyMs,
                    auditRequests24h,
                    auditErrorRate24h,
                    auditErrors24h
                }
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch platform stats' });
    }
};

// 5. Get All Users (Superadmin — All roles)
export const getAllUsers = async (req, res) => {
    try {
        const { role, search, blocked } = req.query;
        let filter = { role: { $ne: 'superadmin' } };

        if (role && role !== 'all') filter.role = role;
        if (blocked === 'true') filter.isBlocked = true;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }

        const users = await User.find(filter)
            .select('name email role isBlocked profileImage createdAt phone instituteId')
            .populate('instituteId', 'name')
            .sort({ createdAt: -1 })
            .limit(200);

        res.json({ success: true, users, count: users.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
};

// 6. Update User Role/Status (Superadmin)
export const updateUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { role, isBlocked } = req.body;

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role === 'superadmin') return res.status(403).json({ success: false, message: 'Cannot modify superadmin' });

        if (role) user.role = role;
        if (isBlocked !== undefined) user.isBlocked = isBlocked;

        await user.save();
        res.json({ success: true, user, message: 'User updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update user' });
    }
};

// 7. Delete User (Superadmin)
export const deleteUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role === 'superadmin') return res.status(403).json({ success: false, message: 'Cannot delete superadmin' });

        await User.findByIdAndDelete(id);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete user' });
    }
};

// 8. Get Activity Log
export const getActivityLog = async (req, res) => {
    try {
        const recentUsers = await User.find({ role: { $ne: 'superadmin' } })
            .select('name email role createdAt profileImage')
            .sort({ createdAt: -1 })
            .limit(50);

        const activities = recentUsers.map(u => ({
            _id: u._id,
            type: 'registration',
            user: { name: u.name, email: u.email, role: u.role, profileImage: u.profileImage },
            description: `${u.name} (${u.role}) registered`,
            timestamp: u.createdAt,
        }));

        res.json({ success: true, activities, count: activities.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch activity log' });
    }
};

// 9. Get all users of a specific institute
export const getInstituteUsers = async (req, res) => {
    try {
        const { id } = req.params;
        const institute = await Institute.findById(id);
        if (!institute) return res.status(404).json({ success: false, message: 'Institute not found' });

        const users = await User.find({ instituteId: id, role: { $ne: 'superadmin' } })
            .select('name email role isBlocked profileImage createdAt phone')
            .sort({ role: 1, createdAt: -1 });

        const admin = users.filter(u => u.role === 'admin');
        const tutors = users.filter(u => u.role === 'tutor');
        const students = users.filter(u => u.role === 'student');

        res.json({
            success: true,
            institute,
            users: { admin, tutors, students },
            counts: { admin: admin.length, tutors: tutors.length, students: students.length, total: users.length }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to fetch institute users' });
    }
};

// 10. Impersonate a user (generate their token for superadmin)
export const impersonateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (user.role === 'superadmin') return res.status(403).json({ success: false, message: 'Cannot impersonate a superadmin' });

        // Generate a short-lived token for the target user
        const jwt = (await import('jsonwebtoken')).default;
        const token = jwt.sign(
            { id: user._id, role: user.role, impersonatedBy: req.user._id },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({
            success: true,
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profileImage: user.profileImage,
            },
            message: `Now impersonating ${user.name} (${user.role})`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to impersonate user' });
    }
};


// @desc    Get complete subscriptions overview for dashboard
// @route   GET /api/superadmin/subscriptions-overview
// @access  Superadmin
export const getSubscriptionsOverview = async (req, res) => {
    try {
        // 1. Fetch all institutes
        const institutes = await Institute.find().sort({ createdAt: -1 }).lean();

        // 2. Fetch all plans to get their pricing
        const plans = await SubscriptionPlan.find().lean();
        const planMap = {};
        plans.forEach(p => {
            // Map by lowercase name for easy matching (e.g., 'basic' -> { price: 2000 })
            planMap[p.name.toLowerCase()] = p;
        });

        // 3. Count Active Students per Institute using Aggregation (Fastest way)
        const studentCounts = await InstituteMembership.aggregate([
            { $match: { roleInInstitute: 'student', status: 'active' } },
            { $group: { _id: '$instituteId', count: { $sum: 1 } } }
        ]);
        const studentCountMap = {};
        studentCounts.forEach(sc => {
            studentCountMap[sc._id.toString()] = sc.count;
        });

        // 4. Calculate KPIs and Format Table Data
        let totalRevenue = 0;
        let newThisMonth = 0;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const planDistribution = { basic: 0, pro: 0, enterprise: 0, free: 0 };
        let totalActiveInstitutes = 0;

        const formattedSubscriptions = institutes.map(inst => {
            // Get Plan details
            const planKey = inst.subscriptionPlan ? inst.subscriptionPlan.toLowerCase() : 'free';
            const planDetails = planMap[planKey] || { price: 0, name: inst.subscriptionPlan };
            const price = planDetails.price || 0;

            // Get Student Count
            const studentCount = studentCountMap[inst._id.toString()] || 0;

            // Determine Status (Active if isActive is true AND expiresAt is in the future)
            const isExpired = inst.subscriptionExpiresAt && new Date(inst.subscriptionExpiresAt) < new Date();
            const status = (inst.isActive && !isExpired) ? 'Active' : 'Expired';

            // Calculate active metrics
            if (status === 'Active') {
                totalRevenue += price;
                totalActiveInstitutes++;
                if (planDistribution[planKey] !== undefined) planDistribution[planKey]++;
            }

            // Check if created this month
            const instDate = new Date(inst.createdAt);
            if (instDate.getMonth() === currentMonth && instDate.getFullYear() === currentYear) {
                newThisMonth++;
            }

            return {
                id: inst._id,
                displayId: `#INST${inst._id.toString().substring(19, 24).toUpperCase()}`, // Creates a short readable ID from Mongo ObjectId
                name: inst.name,
                plan: planDetails.name || planKey.charAt(0).toUpperCase() + planKey.slice(1),
                students: studentCount,
                revenue: price,
                date: instDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                status: status
            };
        });

        // 5. Calculate Donut Chart Distribution Percentages
        const distributionPercentages = [];
        if (totalActiveInstitutes > 0) {
            for (const [key, value] of Object.entries(planDistribution)) {
                if (value > 0) {
                    distributionPercentages.push({
                        name: key.charAt(0).toUpperCase() + key.slice(1),
                        percentage: ((value / totalActiveInstitutes) * 100).toFixed(1),
                        count: value
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            kpis: {
                totalSubscriptions: institutes.length,
                activeSubscriptions: totalActiveInstitutes,
                monthlyRevenue: totalRevenue,
                newThisMonth: newThisMonth
            },
            distribution: distributionPercentages,
            subscriptions: formattedSubscriptions
        });

    } catch (error) {
        console.error('Overview Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};


// Delete Institute Permanently (Safe for Global Users)
export const deleteInstitute = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        const institute = await Institute.findById(id).session(session);
        if (!institute) {
            return res.status(404).json({ success: false, message: 'Institute not found.' });
        }

        // 🌟 THE FIX: Users ko delete NAHI karna hai, sirf Institute se UNLINK karna hai
        await User.updateMany(
            { instituteId: id },
            { $set: { instituteId: null } } // Isse user global/independent ban jayega
        ).session(session);

        // Institute Membership delete karna zaroori hai kyunki wo specific is institute ka data tha
        await InstituteMembership.deleteMany({ instituteId: id }).session(session);

        // Finally, sirf Institute ko delete karo
        await Institute.findByIdAndDelete(id).session(session);

        await session.commitTransaction();
        session.endSession();

        res.json({
            success: true,
            message: 'Institute deleted successfully. All associated users are now independent.'
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Delete Institute Error:", error);
        res.status(500).json({ success: false, message: 'Failed to delete institute' });
    }
};
