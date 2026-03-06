import mongoose from 'mongoose';

const learningEventSchema = new mongoose.Schema({
    eventType: {
        type: String,
        enum: ['attendance_marked', 'live_class_joined', 'assignment_submitted', 'exam_submitted'],
        required: true,
        index: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    role: {
        type: String,
        enum: ['student', 'tutor', 'admin', 'superadmin'],
        required: true,
    },
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        default: null,
        index: true,
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        default: null,
        index: true,
    },
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch',
        default: null,
        index: true,
    },
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true,
    },
    resourceType: {
        type: String,
        default: null,
    },
    meta: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});

learningEventSchema.index({ eventType: 1, createdAt: -1 });
learningEventSchema.index({ instituteId: 1, createdAt: -1 });
learningEventSchema.index({ courseId: 1, createdAt: -1 });
learningEventSchema.index({ batchId: 1, createdAt: -1 });

export default mongoose.model('LearningEvent', learningEventSchema);
