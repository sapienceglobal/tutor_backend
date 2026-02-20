import LessonComment from '../models/LessonComment.js';
import User from '../models/User.js';

// @desc    Get comments for a lesson
// @route   GET /api/comments/:lessonId
// @access  Private
export const getLessonComments = async (req, res) => {
    try {
        const comments = await LessonComment.find({ lessonId: req.params.lessonId })
            .populate('studentId', 'name avatar') // Fetch user details
            .sort({ createdAt: -1 }); // Newest first

        res.json({ success: true, comments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Add a comment to a lesson
// @route   POST /api/comments/:lessonId
// @access  Private
export const addLessonComment = async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ success: false, message: 'Comment text is required' });
        }

        const newComment = new LessonComment({
            lessonId: req.params.lessonId,
            studentId: req.user._id, // Assuming auth middleware adds user to req
            text
        });

        await newComment.save();

        // Populate user details for immediate display
        await newComment.populate('studentId', 'name avatar');

        res.json({ success: true, comment: newComment });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete a comment
// @route   DELETE /api/comments/:commentId
// @access  Private (Author or Tutor/Admin)
export const deleteLessonComment = async (req, res) => {
    try {
        const comment = await LessonComment.findById(req.params.commentId);

        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }

        // Check if user is the author (or add admin check if needed)
        if (comment.studentId.toString() !== req.user._id.toString()) {
            // Allow if user is an admin or the course tutor (logic would require fetching course)
            // For now, restrict to author
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }

        await comment.deleteOne();

        res.json({ success: true, message: 'Comment removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
