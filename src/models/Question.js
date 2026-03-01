import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tutor',
        required: true
    },
    type: {
        type: String,
        enum: ['mcq', 'true_false', 'fill_blank', 'subjective'], // Added subjective
        default: 'mcq'
    },
    question: {
        type: String,
        required: true
    },
    options: [{
        text: { type: String, required: function () { return this.type === 'mcq' || this.type === 'true_false'; } },
        isCorrect: { type: Boolean, default: false }
    }],
    idealAnswer: {
        type: String, // Expected answer or rubric for subjective questions
    },
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
