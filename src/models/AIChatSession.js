import mongoose from 'mongoose';

const aiChatSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        default: 'New Chat'
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        default: null // Optional context for RAG
    },
    messages: [{
        role: {
            type: String,
            enum: ['user', 'assistant', 'system'],
            required: true
        },
        content: {
            type: String,
            required: true
        },
        citations: [{
            title: String,
            content: String,
            similarity: Number
        }],
        contextUsed: {
            type: Boolean,
            default: false
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    aiModel: {
        type: String,
        default: 'llama-3.3-70b-versatile'
    }
}, { timestamps: true });

// Auto-delete empty chats (no user messages) older than 24h
aiChatSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400, partialFilterExpression: { 'messages.1': { $exists: false } } });

export default mongoose.model('AIChatSession', aiChatSessionSchema);
