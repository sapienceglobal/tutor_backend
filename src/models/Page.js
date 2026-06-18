import mongoose from 'mongoose';

const pageSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Page title is required'],
    },
    slug: {
        type: String,
        required: [true, 'Unique slug is required'],
        unique: true,
        lowercase: true,
    },
    content: {
        type: String,
        required: [true, 'Page content is required'],
    },
    isPublished: {
        type: Boolean,
        default: true,
    },
    seoMeta: {
        title: String,
        description: String,
        keywords: String,
    },
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
});

export default mongoose.model('Page', pageSchema);
