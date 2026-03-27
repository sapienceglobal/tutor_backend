import mongoose from 'mongoose';

const doubtLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        instituteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institute',
            default: null,
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            default: null,
        },
        question: {
            type: String,
            required: true,
            trim: true,
        },
        answer: {
            type: String,
            required: true,
        },
        subject: {
            type: String,
            default: null,
            trim: true,
        },
        difficulty: {
            type: String,
            enum: ['Easy', 'Medium', 'Hard', null],
            default: null,
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },
        role: {
            type: String,
            enum: ['student', 'tutor'],
            default: 'tutor',
        },
    },
    { timestamps: true }
);

// Indexes for fast queries
doubtLogSchema.index({ userId: 1, createdAt: -1 });
doubtLogSchema.index({ userId: 1, subject: 1 });
doubtLogSchema.index({ userId: 1, courseId: 1 });

export default mongoose.model('DoubtLog', doubtLogSchema);