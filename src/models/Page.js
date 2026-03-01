import mongoose from 'mongoose';

const pageSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a page title'],
    },
    slug: {
        type: String,
        required: [true, 'Please add a unique slug'],
        unique: true,
        lowercase: true,
    },
    content: {
        type: String,
        required: [true, 'Please add page content'],
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
