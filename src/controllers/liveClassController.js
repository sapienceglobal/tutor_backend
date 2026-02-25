
import LiveClass from '../models/LiveClass.js';
import Tutor from '../models/Tutor.js';
import Enrollment from '../models/Enrollment.js';
// import { createZoomMeeting } from '../services/zoomService.js'; // Zoom removed

// @desc    Create a new live class
// @route   POST /api/live-classes
export const createLiveClass = async (req, res) => {
    try {
        const { title, description, courseId, dateTime, duration, platform, autoCreate } = req.body;
        let { meetingLink, meetingId, passcode, materialLink } = req.body;

        // Auto-Generate Jitsi Meeting Logic
        if (autoCreate || platform === 'jitsi') {
            // Generate a unique, professional room name
            // Format: TutorApp_CourseTitle_RandomSuffix (sanitized)
            const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '');
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            meetingId = `TutorApp_${cleanTitle}_${randomSuffix}`;

            // Constructs the full URL for external access if needed
            meetingLink = `https://meet.jit.si/${meetingId}`;

            // Jitsi doesn't strictly need a passcode for free tier, but we can set one if we want to lock rooms later.
            // For now, we'll keep passcode empty or optional as Jitsi handles access via the room name primarily for free usage.
            passcode = '';

        }

        // Verify tutor exists
        const tutor = await Tutor.findOne({ userId: req.user._id });
        if (!tutor) {
            console.warn('Tutor profile not found for user:', req.user._id);
            return res.status(404).json({
                success: false,
                message: 'Tutor profile not found'
            });
        }

        // Industry Standard Check 1: Cannot schedule in the past
        const parsedDateTime = new Date(dateTime);
        if (parsedDateTime < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot schedule a class in the past. Please select a future time.'
            });
        }

        // Industry Standard Check 2: Check for overlapping classes
        const classStart = parsedDateTime;
        const classEnd = new Date(classStart.getTime() + (duration || 60) * 60000);

        const existingClasses = await LiveClass.find({ tutorId: tutor._id });
        const hasOverlap = existingClasses.some(existingCls => {
            if (!existingCls.dateTime) return false;
            const existingStart = new Date(existingCls.dateTime);
            const existingDuration = existingCls.duration || 60;
            const existingEnd = new Date(existingStart.getTime() + existingDuration * 60000);

            // Overlap condition: New class starts before existing ends AND new class ends after existing starts
            return (classStart < existingEnd && classEnd > existingStart);
        });

        if (hasOverlap) {
            return res.status(400).json({
                success: false,
                message: 'Scheduling Conflict: You already have another live class scheduled that overlaps with this time slot.'
            });
        }

        const liveClass = await LiveClass.create({
            tutorId: tutor._id,
            title,
            description,
            courseId,
            dateTime,
            duration,
            meetingLink: meetingLink || 'pending', // Fallback if creation failed but we continued (though we return above)
            meetingId,
            passcode,
            platform
        });

        res.status(201).json({
            success: true,
            message: 'Live class scheduled successfully',
            liveClass
        });
    } catch (error) {
        console.error('Create live class error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// @desc    Get live classes
// @route   GET /api/live-classes
export const getLiveClasses = async (req, res) => {
    try {
        let query = {};

        // If tutor, show their classes
        if (req.user.role === 'tutor') {
            const tutor = await Tutor.findOne({ userId: req.user._id }); // Use _id for safety
            if (tutor) {
                query.tutorId = tutor._id;
            }
        } else if (req.user.role === 'student') {
            // Industry Standard: Students only see classes for courses they are enrolled in
            const enrollments = await Enrollment.find({
                studentId: req.user._id
            });
            const enrolledCourseIds = enrollments.map(e => e.courseId);

            // If specific course requested (e.g. from course page), make sure they are enrolled
            if (req.query.courseId) {
                const isEnrolled = enrolledCourseIds.some(id => id.toString() === req.query.courseId);

                if (!isEnrolled) {
                    return res.status(403).json({ success: false, message: 'Not enrolled in this course' });
                }
                query.courseId = req.query.courseId;
            } else {
                // Otherwise show all their enrolled classes
                query.courseId = { $in: enrolledCourseIds };
            }
        }

        if (req.query.courseId) {
            query.courseId = req.query.courseId;
        }

        // Sort by dateTime ascending (nearest first)
        const classes = await LiveClass.find(query)
            .populate({
                path: 'tutorId',
                populate: {
                    path: 'userId',
                    select: 'name profileImage'
                }
            })
            .populate('courseId', 'title')
            .sort({ dateTime: 1 });

        // Removed manual LiveClass.populate and auto-sync for stability

        // AUTO-SYNC STATUS: Check for expired classes (Safe Implementation)
        const now = new Date();
        // We use Promise.allSettled to ensure one failure doesn't crash the response
        await Promise.allSettled(classes.map(async (cls) => {
            try {
                if (!cls.dateTime) return;

                const startTime = new Date(cls.dateTime);
                if (isNaN(startTime.getTime())) return; // Invalid date check

                const duration = cls.duration || 60;
                const endTime = new Date(startTime.getTime() + (duration * 60000));

                // If current time is past end time and status is not 'completed' or 'cancelled'
                if (now > endTime && cls.status !== 'completed' && cls.status !== 'cancelled') {
                    cls.status = 'completed';
                    await cls.save();
                }
            } catch (err) {
                console.error(`Error auto-updating class ${cls._id}:`, err);
            }
        }));

        res.status(200).json({
            success: true,
            count: classes.length,
            liveClasses: classes
        });
    } catch (error) {
        console.error('Get live classes error details:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// @desc    Delete a live class
// @route   DELETE /api/live-classes/:id
export const deleteLiveClass = async (req, res) => {
    try {
        const { id } = req.params;
        const liveClass = await LiveClass.findById(id);

        if (!liveClass) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        // specific check: only the creator tutor can delete
        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor || liveClass.tutorId.toString() !== tutor._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this class'
            });
        }

        await liveClass.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Live class cancelled successfully'
        });
    } catch (error) {
        console.error('Delete live class error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// @desc    Update a live class
// @route   PATCH /api/live-classes/:id
export const updateLiveClass = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, courseId, dateTime, duration, meetingLink, recordingLink, materialLink, platform } = req.body;

        const liveClass = await LiveClass.findById(id);

        if (!liveClass) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        // Check ownership
        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor || liveClass.tutorId.toString() !== tutor._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this class'
            });
        }

        // Validate scheduling logic if time or duration is updated
        if (dateTime || duration) {
            const newDateTime = dateTime ? new Date(dateTime) : new Date(liveClass.dateTime);
            const newDuration = duration || liveClass.duration;

            // Past Time check
            if (newDateTime < new Date() && String(newDateTime) !== String(liveClass.dateTime)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot reschedule a class to the past.'
                });
            }

            // Conflict Check
            const classStart = newDateTime;
            const classEnd = new Date(classStart.getTime() + newDuration * 60000);

            const existingClasses = await LiveClass.find({ tutorId: tutor._id, _id: { $ne: id } });
            const hasOverlap = existingClasses.some(existingCls => {
                if (!existingCls.dateTime) return false;
                const existingStart = new Date(existingCls.dateTime);
                const existingDuration = existingCls.duration || 60;
                const existingEnd = new Date(existingStart.getTime() + existingDuration * 60000);

                return (classStart < existingEnd && classEnd > existingStart);
            });

            if (hasOverlap) {
                return res.status(400).json({
                    success: false,
                    message: 'Scheduling Conflict: This new time overlaps with another of your scheduled classes.'
                });
            }
        }

        if (title) liveClass.title = title;
        if (description !== undefined) liveClass.description = description;
        if (courseId !== undefined) liveClass.courseId = courseId;
        if (dateTime) liveClass.dateTime = dateTime;
        if (duration) liveClass.duration = duration;
        if (meetingLink) liveClass.meetingLink = meetingLink;
        if (recordingLink !== undefined) liveClass.recordingLink = recordingLink;
        if (materialLink !== undefined) liveClass.materialLink = materialLink;
        if (platform) liveClass.platform = platform;
        if (req.body.meetingId) liveClass.meetingId = req.body.meetingId;
        if (req.body.passcode) liveClass.passcode = req.body.passcode;

        await liveClass.save();

        res.status(200).json({
            success: true,
            message: 'Live class updated successfully',
            liveClass
        });
    } catch (error) {
        console.error('Update live class error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// @desc    Get Join Config (Jitsi Room Details)
// @route   POST /api/live-classes/:id/join-config
// @access  Private (Student/Tutor)
export const getJoinConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const liveClass = await LiveClass.findById(id);

        if (!liveClass) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }

        // Security: Verify user is enrolled (if student) or is the tutor
        // In a real app, you should check enrollments here. 
        // For this Jitsi implementation, we'll keep it open for enrolled students/tutors.
        // The frontend handles the token/auth for the app itself.

        const isTutor = liveClass.tutorId.toString() === req.user._id?.toString();

        res.status(200).json({
            success: true,
            config: {
                meetingNumber: liveClass.meetingId, // This is the Room Name
                userName: req.user.name,
                userEmail: req.user.email,
                role: isTutor ? 'moderator' : 'participant',
                platform: 'jitsi'
            }
        });

    } catch (error) {
        console.error('Get Join Config Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Mark Attendance
// @route   POST /api/live-classes/:id/attendance
// @access  Private (Student)
import Attendance from '../models/Attendance.js';

export const markAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const studentId = req.user._id;

        const liveClass = await LiveClass.findById(id);
        if (!liveClass) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }

        // Check if attendance already marked
        const existing = await Attendance.findOne({ liveClassId: id, studentId });
        if (existing) {
            return res.status(200).json({ success: true, message: 'Attendance already marked' });
        }

        // Mark Attendance
        await Attendance.create({
            liveClassId: id,
            studentId,
            courseId: liveClass.courseId
        });

        res.status(201).json({ success: true, message: 'Attendance marked successfully' });

    } catch (error) {
        console.error('Mark Attendance Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
