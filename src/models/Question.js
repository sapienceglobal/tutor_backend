import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tutor',
        required: true
    },
    type: {
        type: String,
        enum: ['mcq', 'true_false', 'fill_blank'], // Extensible
        default: 'mcq'
    },
    question: {
        type: String,
        required: true
    },
    options: [{
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false }
    }],
    explanation: String,
    points: { type: Number, default: 1 },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    tags: [String], // Can link to Skills/Topics names
    topicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic'
    },
    skillId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('Question', questionSchema);
