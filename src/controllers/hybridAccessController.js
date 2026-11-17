import Course from '../models/Course.js';
import LiveClass from '../models/LiveClass.js';
import TutorProfile from '../models/TutorProfile.js';
import User from '../models/User.js';
import InstituteMembership from '../models/InstituteMembership.js';
import TutorStudentLink from '../models/TutorStudentLink.js';
import Tutor from '../models/Tutor.js';

/**
 * @desc    Check if user can access course
 * @route   POST /api/access/check-course-access
 * @access   Private
 */
export const checkCourseAccess = async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = req.user.id;

        // Get course details
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Check access based on visibility
        const canAccess = await checkContentAccess(userId, course, 'course');
        
        res.json({
            success: true,
            canAccess,
            course: {
                id: course._id,
                title: course.title,
                visibility: course.visibility,
                tutorId: course.tutorId
            }
        });
    } catch (error) {
        console.error('Check course access error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Check if user can access live class
 * @route   POST /api/access/check-liveclass-access
 * @access   Private
 */
export const checkLiveClassAccess = async (req, res) => {
    try {
        const { liveClassId } = req.body;
        const userId = req.user.id;

        // Get live class details
        const liveClass = await LiveClass.findById(liveClassId);
        if (!liveClass) {
            return res.status(404).json({
                success: false,
                message: 'Live class not found'
            });
        }

        // Check access based on visibility
        const canAccess = await checkContentAccess(userId, liveClass, 'liveClass');
        
        res.json({
            success: true,
            canAccess,
            liveClass: {
                id: liveClass._id,
                title: liveClass.title,
                visibility: liveClass.visibility,
                tutorId: liveClass.tutorId
            }
        });
    } catch (error) {
        console.error('Check live class access error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get courses visible to user
 * @route   GET /api/access/visible-courses
 * @access   Private
 */
export const getVisibleCourses = async (req, res) => {
    try {
        if (req.user?.role !== 'superadmin' && (!req.hasActiveWorkspace || req.workspace?.type === 'none')) {
            return res.status(403).json({
                success: false,
                code: 'PORTAL_APPROVAL_REQUIRED',
                message: 'Your join request is awaiting approval from an Institute or Private Tutor.',
            });
        }

        const { page = 1, limit = 20, category, search } = req.query;
        const query = { status: 'published' };

        if (req.workspace?.type === 'institute' && req.workspace.instituteId) {
            query.instituteId = req.workspace.instituteId;
        } else if (req.workspace?.type === 'private_tutor') {
            query.instituteId = null;
            if (req.user.role === 'tutor') {
                query.tutorId = req.workspace.tutorId;
            } else if (req.user.role === 'student') {
                const tutorIds = req.workspace.filterTutorId
                    ? [req.workspace.filterTutorId]
                    : (req.workspace.activeTutorIds || []);
                if (tutorIds.length === 0) {
                    return res.json({ success: true, courses: [], pagination: { page: 1, limit: parseInt(limit), total: 0, pages: 0 } });
                }
                query.tutorId = { $in: tutorIds };
            }
        }

        if (category) {
            query.categoryId = category;
        }
        if (search) {
            query.$text = { $search: search };
        }

        const courses = await Course.find(query)
            .populate('tutorId', 'name profileImage')
            .populate('categoryId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Course.countDocuments(query);

        res.json({
            success: true,
            courses,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get visible courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get live classes visible to user
 * @route   GET /api/access/visible-live-classes
 * @access   Private
 */
export const getVisibleLiveClasses = async (req, res) => {
    try {
        if (req.user?.role !== 'superadmin' && (!req.hasActiveWorkspace || req.workspace?.type === 'none')) {
            return res.status(403).json({
                success: false,
                code: 'PORTAL_APPROVAL_REQUIRED',
                message: 'Your join request is awaiting approval from an Institute or Private Tutor.',
            });
        }

        const { page = 1, limit = 20, search } = req.query;
        const query = { dateTime: { $gte: new Date() } };

        if (req.workspace?.type === 'institute' && req.workspace.instituteId) {
            query.instituteId = req.workspace.instituteId;
        } else if (req.workspace?.type === 'private_tutor') {
            query.instituteId = null;
            if (req.user.role === 'tutor') {
                query.tutorId = req.workspace.tutorId;
            } else if (req.user.role === 'student') {
                const tutorIds = req.workspace.filterTutorId
                    ? [req.workspace.filterTutorId]
                    : (req.workspace.activeTutorIds || []);
                if (tutorIds.length === 0) {
                    return res.json({ success: true, liveClasses: [], pagination: { page: 1, limit: parseInt(limit), total: 0, pages: 0 } });
                }
                query.tutorId = { $in: tutorIds };
            }
        }

        if (search) {
            query.$text = { $search: search };
        }

        const liveClasses = await LiveClass.find(query)
            .populate('tutorId', 'name profileImage')
            .populate('courseId', 'title')
            .sort({ dateTime: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await LiveClass.countDocuments(query);

        res.json({
            success: true,
            liveClasses,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get visible live classes error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get tutors visible to user
 * @route   GET /api/access/visible-tutors
 * @access   Private
 */
export const getVisibleTutors = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, search } = req.query;

        const tutors = await TutorProfile.findVisibleToUser(userId, {
            limit: parseInt(limit),
            search
        });

        const total = tutors.length;

        res.json({
            success: true,
            tutors,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get visible tutors error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Check if user can book appointment with tutor
 * @route   POST /api/access/check-appointment-access
 * @access   Private
 */
export const checkAppointmentAccess = async (req, res) => {
    try {
        const { tutorId } = req.body;
        const userId = req.user.id;

        // Get tutor profile
        const tutorProfile = await TutorProfile.findOne({ userId: tutorId });
        if (!tutorProfile) {
            return res.status(404).json({
                success: false,
                message: 'Tutor profile not found'
            });
        }

        // Check if user can book appointment
        const canBook = await tutorProfile.canUserBookAppointment(userId);
        
        res.json({
            success: true,
            canBook,
            tutor: {
                id: tutorId,
                profileVisibility: tutorProfile.profileVisibility,
                appointmentSettings: tutorProfile.appointmentSettings
            }
        });
    } catch (error) {
        console.error('Check appointment access error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * Helper function to check content access
 */
async function checkContentAccess(userId, content, contentType) {
    const user = await User.findById(userId);
    if (!user) return false;
    if (user.role === 'superadmin') return true;

    if (content.instituteId) {
        if (String(user.instituteId) === String(content.instituteId)) return true;
        const hasMembership = await InstituteMembership.exists({
            userId,
            instituteId: content.instituteId,
            status: 'active',
        });
        return Boolean(hasMembership);
    }

    // Private Tutor Studio content requires owner tutor or active TutorStudentLink
    let contentTutorId = content.tutorId?._id || content.tutorId || null;
    if (!contentTutorId && content.createdBy) {
        const tutorDoc = await Tutor.findOne({ userId: content.createdBy }).select('_id').lean();
        contentTutorId = tutorDoc?._id || null;
    }
    if (user.role === 'tutor') {
        const selfTutor = await Tutor.findOne({ userId }).select('_id').lean();
        return Boolean(selfTutor && contentTutorId && String(selfTutor._id) === String(contentTutorId));
    }

    if (contentTutorId) {
        const hasLink = await TutorStudentLink.exists({
            studentId: userId,
            tutorId: contentTutorId,
            status: 'active',
        });
        return Boolean(hasLink);
    }

    return false;
}

/**
 * Helper function to get user workspace posture
 */
async function getUserType(userId) {
    const [memberships, tutorLinks, tutor] = await Promise.all([
        InstituteMembership.countDocuments({ userId, status: 'active' }),
        TutorStudentLink.countDocuments({ studentId: userId, status: 'active' }),
        Tutor.findOne({ userId }).select('privateTeaching').lean(),
    ]);

    const hasInstitute = memberships > 0;
    const hasPrivate = tutorLinks > 0 || tutor?.privateTeaching?.isEnabled === true;

    if (hasInstitute && hasPrivate) return 'dual';
    if (hasInstitute) return 'institute';
    if (hasPrivate) return 'private_tutor';
    return 'pending';
}
