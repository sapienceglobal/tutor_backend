import mongoose from 'mongoose';
import {
    AUDIENCE_SCOPES,
    normalizeAudienceInput,
    syncLegacyAudience,
    validateAudience,
} from '../utils/audience.js';

const assignmentSchema = new mongoose.Schema({
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        required: false,
        default: null,
        index: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch',
        default: null
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
    moduleId: {
        type: mongoose.Schema.Types.ObjectId
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String
    },
    dueDate: {
        type: Date
    },
    totalMarks: {
        type: Number,
        default: 100
    },
    rubric: [{
        criterion: { type: String, required: true },
        description: String,
        points: { type: Number, required: true }
    }],
    attachments: [{
        name: { type: String },
        url: { type: String },
        // Keep field name as `type` for API compatibility; wrap it so Mongoose does not treat
        // the entire attachment object as a primitive schema type.
        type: { type: String }
    }],
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'published'
    }
}, { timestamps: true });

assignmentSchema.pre('save', function () {
    const normalizedAudience = normalizeAudienceInput({
        audience: this.audience,
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

export default mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);
