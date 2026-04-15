import mongoose from 'mongoose';

const liveSessionSchema = new mongoose.Schema({
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        required: true,
        index: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Assuming Tutors are in the User model
        required: true
    },
    title: {
        type: String,
        required: true
    },
    meetingId: {
        type: String, // Zoom ID, Jitsi Room name, or Stream Key
        required: true
    },
    status: {
        type: String,
        enum: ['ongoing', 'ended', 'force_killed'],
        default: 'ongoing',
        index: true // Indexed for super fast radar scanning
    },
    participantCount: {
        type: Number,
        default: 0 // Live concurrent users (CCU)
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    endedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

export default mongoose.model('LiveSession', liveSessionSchema);