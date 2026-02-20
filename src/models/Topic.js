import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Topic name is required'],
        trim: true
    },
    description: String,
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    },
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tutor',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Topic names should be unique per tutor or course context if needed, but simple unique for now
topicSchema.index({ name: 1, tutorId: 1 }, { unique: true });

export default mongoose.model('Topic', topicSchema);
