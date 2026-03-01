import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a blog title'],
    },
    slug: {
        type: String,
        required: [true, 'Please add a unique slug'],
        unique: true,
        lowercase: true,
    },
    excerpt: {
        type: String,
        default: '',
    },
    content: {
        type: String,
        required: [true, 'Please add blog content'],
    },
    thumbnail: {
        type: String,
        default: '',
    },
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    isPublished: {
        type: Boolean,
        default: true,
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'scheduled'],
        default: 'published',
    },
    scheduledPublishAt: {
        type: Date,
        default: null,
    },
    seoMeta: {
        title: String,
        description: String,
        keywords: String,
    },
    tags: [String],
    category: {
        type: String,
        default: 'General',
        trim: true,
    },
}, {
    timestamps: true,
});

export default mongoose.model('Blog', blogSchema);
