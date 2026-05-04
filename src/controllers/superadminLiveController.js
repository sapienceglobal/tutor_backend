import LiveClass from '../models/LiveClass.js';
import LiveSession from '../models/LiveSession.js';

// @desc    Get all active/scheduled live classes (God Radar)
// @route   GET /api/superadmin/live-classes/radar
// @access  Private/Superadmin
export const getLiveRadar = async (req, res) => {
    try {
        // ✅ FIX: Fetch from LiveClass instead of LiveSession since webhook might not be active yet
        let activeClasses = await LiveClass.find({ 
            status: { $in: ['live', 'scheduled'] } 
        })
            .populate('instituteId', 'name subdomain')
            .populate('courseId', 'title')
            // tutorId refs 'Tutor', so we need to deep populate 'userId'
            .populate({
                path: 'tutorId',
                populate: {
                    path: 'userId',
                    select: 'name email profileImage'
                }
            })
            .sort({ dateTime: -1 });

        // Map fields to match what the Frontend Radar expects
        const activeSessions = activeClasses.map(cls => {
            const sessionObj = cls.toObject();
            
            // Map Tutor's underlying User details for UI
            if (sessionObj.tutorId && sessionObj.tutorId.userId) {
                sessionObj.tutorId.name = sessionObj.tutorId.userId.name;
                sessionObj.tutorId.email = sessionObj.tutorId.userId.email;
                sessionObj.tutorId.profileImage = sessionObj.tutorId.userId.profileImage;
            }

            // Map mapping keys for UI
            sessionObj.participantCount = 0; // Hardcoded until real webhooks are connected
            sessionObj.startedAt = sessionObj.dateTime; // Fallback for UI timer
            
            return sessionObj;
        });

        // Calculate KPIs
        const totalActiveStreams = activeSessions.length;
        const totalCCU = 0; // Will be 0 until real metrics logic is implemented

        // Calculate total streams today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const streamsToday = await LiveClass.countDocuments({ dateTime: { $gte: today } });

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

        // ✅ FIX: Use LiveClass and set status to 'cancelled' (since 'force_killed' is not in enum)
        const session = await LiveClass.findByIdAndUpdate(
            id,
            { 
                status: 'cancelled' // Enum valid value
            },
            { new: true }
        );

        if (!session) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        // NOTE: Asli app me yahan ek Socket.io ya Pusher event emit kar dena 
        // jo tutor/students ke frontend ko force disconnect kar de.

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