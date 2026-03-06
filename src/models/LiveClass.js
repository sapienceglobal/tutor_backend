
import mongoose from 'mongoose';
import {
    AUDIENCE_SCOPES,
    normalizeAudienceInput,
    syncLegacyAudience,
    validateAudience,
} from '../utils/audience.js';

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
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch',
        default: null
    },
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        default: null
    },
    visibility: {
        type: String,
        enum: ['public', 'institute'],
        default: 'institute',
        index: true
    },
    audience: {
        scope: {
            type: String,
            enum: Object.values(AUDIENCE_SCOPES),
            default: function () {
                if (this.batchId) return AUDIENCE_SCOPES.BATCH;
                return this.instituteId ? AUDIENCE_SCOPES.INSTITUTE : AUDIENCE_SCOPES.GLOBAL;
            },
            index: true,
        },
        instituteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institute',
            default: null,
        },
        batchIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Batch',
        }],
        studentIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        }],
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

liveClassSchema.pre('save', function () {
    const normalizedAudience = normalizeAudienceInput({
        audience: this.audience,
        visibility: this.visibility,
        instituteId: this.instituteId,
        batchId: this.batchId,
        batchIds: this.batchId ? [this.batchId] : [],
    }, {
        defaultScope: this.batchId
            ? AUDIENCE_SCOPES.BATCH
            : (this.instituteId ? AUDIENCE_SCOPES.INSTITUTE : AUDIENCE_SCOPES.GLOBAL),
        defaultInstituteId: this.instituteId,
    });

    const validatedAudience = validateAudience(normalizedAudience, {
        requireInstituteId: false,
        allowEmptyPrivate: true,
    });

    syncLegacyAudience(this, validatedAudience);
});

export default mongoose.model('LiveClass', liveClassSchema);
