
import LiveClass from '../models/LiveClass.js';
import Tutor from '../models/Tutor.js';

// @desc    Create a new live class
// @route   POST /api/live-classes
export const createLiveClass = async (req, res) => {
    try {
        console.log('POST /live-classes (Create) request:', {
            user: req.user ? req.user._id : 'No user',
            body: req.body
        });

        const { title, description, courseId, dateTime, duration, meetingLink, platform } = req.body;

        // Verify tutor exists
        const tutor = await Tutor.findOne({ userId: req.user._id });
        if (!tutor) {
             console.warn('Tutor profile not found for user:', req.user._id);
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

        console.log('Live class created:', liveClass._id);

        res.status(201).json({
            success: true,
            message: 'Live class scheduled successfully',
            liveClass
        });
    } catch (error) {
        console.error('Create live class error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            debug: error.message
        });
    }
};

// @desc    Get live classes
// @route   GET /api/live-classes
export const getLiveClasses = async (req, res) => {
    try {
        console.log('GET /live-classes request:', {
            user: req.user ? { id: req.user._id, role: req.user.role } : 'No user',
            query: req.query
        });

        let query = {};

        // If tutor, show their classes
        if (req.user.role === 'tutor') {
            const tutor = await Tutor.findOne({ userId: req.user._id }); // Use _id for safety
            if (tutor) {
                query.tutorId = tutor._id;
            } else {
                console.warn('Tutor profile not found for user:', req.user._id);
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
            message: 'Internal server error',
            debug: error.message
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
