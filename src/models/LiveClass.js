
import mongoose from 'mongoose';

const liveClassSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Class title is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tutor',
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    },
    dateTime: {
        type: Date,
        required: [true, 'Date and time is required']
    },
    duration: {
        type: Number, // in minutes
        required: [true, 'Duration is required'],
        default: 60
    },
    meetingLink: {
        type: String,
        required: [true, 'Meeting link is required'],
        trim: true
    },
    meetingId: {
        type: String,
        trim: true
    },
    passcode: {
        type: String,
        trim: true
    },
    platform: {
        type: String,
        enum: ['zoom', 'google_meet', 'jitsi', 'other'],
        default: 'zoom'
    },
    recordingLink: {
        type: String,
        trim: true
    },
    materialLink: { // For Notes/PDFs
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['scheduled', 'live', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('LiveClass', liveClassSchema);
