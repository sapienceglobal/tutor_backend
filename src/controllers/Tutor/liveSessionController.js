import LiveSession from '../../models/LiveSession.js';

// @desc    Start a live session (Triggered when Tutor clicks 'Start Class')
// @route   POST /api/tutor/live-session/start
export const startLiveSession = async (req, res) => {
    try {
        const { courseId, title, meetingId, instituteId } = req.body;

        if (!courseId || !meetingId || !title) {
            return res.status(400).json({ success: false, message: 'Missing required fields: courseId, title, meetingId' });
        }

        // Check if a session with this meetingId is already running
        const existingSession = await LiveSession.findOne({ meetingId, status: 'ongoing' });
        if (existingSession) {
             return res.status(200).json({ success: true, liveSession: existingSession });
        }

        const liveSession = await LiveSession.create({
            instituteId: req.tenant?._id || instituteId,
            courseId,
            tutorId: req.user._id,
            title,
            meetingId,
            status: 'ongoing',
            participantCount: 1, // Assuming the tutor is the first participant
            startedAt: Date.now()
        });

        res.status(201).json({ success: true, liveSession });
    } catch (error) {
        console.error('Start Live Session Error:', error);
        res.status(500).json({ success: false, message: 'Failed to start live session' });
    }
};
