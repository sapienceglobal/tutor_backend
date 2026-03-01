import mongoose from 'mongoose';

const aiUsageLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        default: null,
    },
    action: {
        type: String,
        enum: ['question_generation', 'tutor_chat', 'lesson_quiz', 'summarize_lesson', 'revision_notes', 'analytics'],
        required: true,
    },
    tokenCount: {
        type: Number,
        default: 0,
    },
    model: {
        type: String,
        default: 'groq',
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });

aiUsageLogSchema.index({ userId: 1, createdAt: -1 });
aiUsageLogSchema.index({ instituteId: 1, createdAt: -1 });
aiUsageLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model('AIUsageLog', aiUsageLogSchema);
