import LiveSession from '../models/LiveSession.js';

// @desc    Get all active live classes (God Radar)
// @route   GET /api/superadmin/live-classes/radar
// @access  Private/Superadmin
export const getLiveRadar = async (req, res) => {
    try {
        // Fetch ONLY ongoing sessions
        let activeSessions = await LiveSession.find({ status: 'ongoing' })
            .populate({
                path: 'tutorId',
                populate: {
                    path: 'userId',
                    select: 'name email profileImage'
                }
            })
            .populate('instituteId', 'name subdomain')
            .populate('courseId', 'title')
            .sort({ startedAt: -1 });

        // Map userId fields to tutorId to match frontend expectations
        activeSessions = activeSessions.map(session => {
            const sessionObj = session.toObject();
            if (sessionObj.tutorId && sessionObj.tutorId.userId) {
                sessionObj.tutorId.name = sessionObj.tutorId.userId.name;
                sessionObj.tutorId.email = sessionObj.tutorId.userId.email;
                sessionObj.tutorId.profileImage = sessionObj.tutorId.userId.profileImage;
            }
            return sessionObj;
        });

        // Calculate KPIs
        const totalActiveStreams = activeSessions.length;
        
        // Total Concurrent Users (CCU) right now
        const totalCCU = activeSessions.reduce((acc, session) => acc + (session.participantCount || 0), 0);

        // Calculate total streams today (including ended)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const streamsToday = await LiveSession.countDocuments({ startedAt: { $gte: today } });

        res.status(200).json({
            success: true,
            data: {
                activeSessions,
                kpis: {
                    totalActiveStreams,
                    totalCCU,
                    streamsToday
                }
            }
        });
    } catch (error) {
        console.error('Live Radar Fetch Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch live radar data' });
    }
};

// @desc    Force end a rogue/forgotten live session
// @route   PATCH /api/superadmin/live-classes/:id/force-kill
// @access  Private/Superadmin
export const forceKillSession = async (req, res) => {
    try {
        const { id } = req.params;

        const session = await LiveSession.findByIdAndUpdate(
            id,
            { 
                status: 'force_killed', 
                endedAt: new Date(),
                participantCount: 0 // Reset CCU
            },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        // NOTE: Asli app me yahan ek Socket.io ya Pusher event emit kar dena 
        // jo tutor/students ke frontend ko force disconnect kar de.
        // io.to(session.meetingId).emit('session_force_ended_by_admin');

        res.status(200).json({
            success: true,
            message: 'Session has been force terminated.',
            data: session
        });
    } catch (error) {
        console.error('Force Kill Error:', error);
        res.status(500).json({ success: false, message: 'Failed to force kill session' });
    }
};