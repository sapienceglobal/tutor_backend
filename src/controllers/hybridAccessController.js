import Course from '../models/Course.js';
import LiveClass from '../models/LiveClass.js';
import TutorProfile from '../models/TutorProfile.js';
import User from '../models/User.js';
import InstituteMembership from '../models/InstituteMembership.js';

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
        const userId = req.user.id;
        const { page = 1, limit = 20, category, search } = req.query;

        // Build query based on user type
        const user = await User.findById(userId);
        let query = { status: 'published' };

        if (user.instituteId) {
            // User has institute - show institute courses + public courses
            query.$or = [
                { visibility: 'public' },
                { visibility: 'institute', instituteId: user.instituteId }
            ];
        } else {
            // Independent user - show only public courses
            query.visibility = 'public';
        }

        // Add filters
        if (category) {
            query.categoryId = category;
        }

        if (search) {
            query.$text = {
                $search: search
            };
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
        const userId = req.user.id;
        const { page = 1, limit = 20, search } = req.query;

        // Build query based on user type
        const user = await User.findById(userId);
        let query = {};

        if (user.instituteId) {
            // User has institute - show institute classes + public classes
            query.$or = [
                { visibility: 'public' },
                { visibility: 'institute', instituteId: user.instituteId }
            ];
        } else {
            // Independent user - show only public classes
            query.visibility = 'public';
        }

        // Add time filter for future classes
        query.dateTime = { $gte: new Date() };

        if (search) {
            query.$text = {
                $search: search
            };
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

    // Public content - everyone can access
    if (content.visibility === 'public') {
        return true;
    }

    // Institute content - only same institute members can access
    if (content.visibility === 'institute') {
        if (!user.instituteId) return false; // Independent user can't access institute content
        
        // Check if user belongs to the same institute as the content
        if (content.instituteId) {
            return user.instituteId.toString() === content.instituteId.toString();
        }
        
        // If content doesn't have instituteId, check tutor's institute
        if (contentType === 'course') {
            const tutor = await User.findById(content.tutorId);
            return tutor && user.instituteId.toString() === (tutor.instituteId || '').toString();
        }
        
        if (contentType === 'liveClass') {
            const tutor = await User.findById(content.tutorId);
            return tutor && user.instituteId.toString() === (tutor.instituteId || '').toString();
        }
    }

    return false;
}

/**
 * Helper function to get user type
 */
async function getUserType(userId) {
    const user = await User.findById(userId);
    
    if (!user) return 'unknown';
    
    if (user.instituteId) {
        // Check if user has active membership
        const membership = await InstituteMembership.findOne({
            userId,
            instituteId: user.instituteId,
            status: 'active'
        });
        
        return membership ? 'institute' : 'independent';
    }
    
    return 'independent';
}
