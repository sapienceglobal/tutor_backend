
import LiveClass from '../models/LiveClass.js';
import Tutor from '../models/Tutor.js';

// @desc    Create a new live class
// @route   POST /api/live-classes
export const createLiveClass = async (req, res) => {
    try {
        const { title, description, courseId, dateTime, duration, meetingLink, platform } = req.body;

        // Verify tutor exists
        const tutor = await Tutor.findOne({ userId: req.user.id });
        if (!tutor) {
            return res.status(404).json({
                success: false,
                message: 'Tutor profile not found'
            });
        }

        const liveClass = await LiveClass.create({
            tutorId: tutor._id,
            title,
            description,
            courseId,
            dateTime,
            duration,
            meetingLink,
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
            const tutor = await Tutor.findOne({ userId: req.user.id });
            if (tutor) {
                query.tutorId = tutor._id;
            }
        }
        // If student, potentially filter by enrolled courses (future scope)
        // For now, show all public classes or implement logic to show relevant ones
        // We can also support query params for filtering
        if (req.query.courseId) {
            query.courseId = req.query.courseId;
        }

        // Sort by dateTime ascending (nearest first)
        const classes = await LiveClass.find(query)
            .populate('tutorId') // Populate Tutor doc first
            .populate('courseId', 'title')
            .sort({ dateTime: 1 });

        // Deep populate userId from the populated tutorId
        await LiveClass.populate(classes, {
            path: 'tutorId.userId',
            select: 'name profileImage'
        });

        // AUTO-SYNC STATUS: Check for expired classes
        const now = new Date();

        // Use Promise.all to update statuses in parallel if needed
        classes = await Promise.all(classes.map(async (cls) => {
            const startTime = new Date(cls.dateTime);
            const endTime = new Date(startTime.getTime() + (cls.duration * 60000)); // duration is in minutes

            // If current time is past end time and status is not 'completed' or 'cancelled'
            if (now > endTime && cls.status !== 'completed' && cls.status !== 'cancelled') {
                cls.status = 'completed';
                await cls.save(); // Save the updated status to DB
            }

            return cls;
        }));

        res.status(200).json({
            success: true,
            count: classes.length,
            liveClasses: classes
        });
    } catch (error) {
        console.error('Get live classes error:', error);
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
        const { title, description, courseId, dateTime, duration, meetingLink, recordingLink, platform } = req.body;

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

        if (title) liveClass.title = title;
        if (description !== undefined) liveClass.description = description;
        if (courseId !== undefined) liveClass.courseId = courseId;
        if (dateTime) liveClass.dateTime = dateTime;
        if (duration) liveClass.duration = duration;
        if (meetingLink) liveClass.meetingLink = meetingLink;
        if (recordingLink !== undefined) liveClass.recordingLink = recordingLink;
        if (platform) liveClass.platform = platform;

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
