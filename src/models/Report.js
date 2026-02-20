import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    targetType: {
        type: String,
        enum: ['Course', 'Tutor', 'Review'],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    reason: {
        type: String,
        required: true,
        enum: ['Inappropriate Content', 'Spam', 'Harassment', 'Misleading Information', 'Other']
    },
    description: {
        type: String,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ['Pending', 'Reviewed', 'Resolved', 'Dismissed'],
        default: 'Pending'
    }
}, { timestamps: true });

const Report = mongoose.model('Report', reportSchema);

export default Report;
