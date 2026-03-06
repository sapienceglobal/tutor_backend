import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    role: {
        type: String,
        enum: ['student', 'tutor'],
        required: true,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    reason: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    adminComment: {
        type: String,
        trim: true,
    },
    documents: [{
        name: { type: String },
        url: { type: String, required: true },
        type: { type: String },
    }],
    substituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tutor',
        default: null,
    }
}, { timestamps: true });

export default mongoose.model('Leave', leaveSchema);
