import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure a user can only wishlist a course once
wishlistSchema.index({ user: 1, course: 1 }, { unique: true });

const Wishlist = mongoose.model('Wishlist', wishlistSchema);

export default Wishlist;
