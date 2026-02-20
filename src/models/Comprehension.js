import mongoose from 'mongoose';

const comprehensionSchema = new mongoose.Schema({
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tutor',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String, // Rich text passage
        required: true
    },
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('Comprehension', comprehensionSchema);
