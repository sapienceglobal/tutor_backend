import Wishlist from '../models/Wishlist.js';
import Course from '../models/Course.js';

export const addToWishlist = async (req, res) => {
    try {
        const { courseId } = req.body;
        const userId = req.user.id; // Corrected from req.user._id to req.user.id (standardize)

        const existing = await Wishlist.findOne({ user: userId, course: courseId });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Course already in wishlist' });
        }

        const wishlist = await Wishlist.create({
            user: userId,
            course: courseId
        });

        res.status(201).json({ success: true, data: wishlist });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const removeFromWishlist = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user.id;

        await Wishlist.findOneAndDelete({ user: userId, course: courseId });

        res.status(200).json({ success: true, message: 'Removed from wishlist' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getWishlist = async (req, res) => {
    try {
        const userId = req.user.id;

        const wishlist = await Wishlist.find({ user: userId })
            .populate({
                path: 'course',
                populate: { path: 'tutorId', select: 'userId' } // Tutor usually has userId reference for name
            })
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, data: wishlist });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const checkWishlistStatus = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user.id;

        const exists = await Wishlist.exists({ user: userId, course: courseId });

        res.status(200).json({ success: true, inWishlist: !!exists });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
