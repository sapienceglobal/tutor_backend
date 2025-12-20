import Review from '../models/Review.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import { createNotification } from './notificationController.js';
import mongoose from 'mongoose';
import Tutor from '../models/Tutor.js';

// @desc    Create a review
// @route   POST /api/reviews
export const createReview = async (req, res) => {
    try {
        const { courseId, rating, comment } = req.body;

        // Validation
        if (!courseId || !rating || !comment) {
            return res.status(400).json({
                success: false,
                message: 'Course ID, rating, and comment are required',
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5',
            });
        }

        // Check if course exists
        const course = await Course.findById(courseId).populate('tutorId');
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found',
            });
        }

        // Check if student is enrolled
        const enrollment = await Enrollment.findOne({
            studentId: req.user.id,
            courseId,
            status: { $in: ['active', 'completed'] },
        });

        if (!enrollment) {
            return res.status(403).json({
                success: false,
                message: 'You must be enrolled in this course to leave a review',
            });
        }

        // Check if review already exists
        const existingReview = await Review.findOne({
            studentId: req.user.id,
            courseId,
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this course. You can edit your existing review.',
            });
        }

        // Create review
        const review = await Review.create({
            courseId,
            studentId: req.user.id,
            rating,
            comment: comment.trim(),
        });

        // Populate student info
        await review.populate('studentId', 'name profileImage');

        // Create notification for tutor
        if (course.tutorId && course.tutorId.userId) {
            await createNotification({
                userId: course?.tutorId?.userId?.toString(),
                type: 'new_review',
                title: '⭐ New Review Received!',
                message: `${req.user?.name ?? 'Someone'} left a ${rating}-star review on "${course?.title ?? 'your course'}"`,
                data: {
                    courseId: course?._id,
                    reviewId: review?._id,
                },
            });

        }

        console.log('✅ Review created successfully:', review._id);

        res.status(201).json({
            success: true,
            message: 'Review posted successfully',
            review,
        });
    } catch (error) {
        console.error('❌ Create review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create review',
            error: error.message,
        });
    }
};

// @desc    Get reviews for a course
// @route   GET /api/reviews/course/:courseId
export const getCourseReviews = async (req, res) => {
    try {
        const { courseId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const sortBy = req.query.sortBy || 'recent'; // recent, helpful, rating

        let sortOptions = {};
        switch (sortBy) {
            case 'helpful':
                sortOptions = { helpfulCount: -1, createdAt: -1 };
                break;
            case 'rating':
                sortOptions = { rating: -1, createdAt: -1 };
                break;
            case 'recent':
            default:
                sortOptions = { createdAt: -1 };
        }

        const reviews = await Review.find({ courseId })
            .populate('studentId', 'name profileImage')
            .sort(sortOptions)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const totalReviews = await Review.countDocuments({ courseId });

        // Calculate rating distribution
        const ratingDistribution = await Review.aggregate([
            { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
            {
                $group: {
                    _id: '$rating',
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: -1 } },
        ]);

        // Format distribution
        const distribution = [5, 4, 3, 2, 1].map(rating => {
            const found = ratingDistribution.find(d => d._id === rating);
            return {
                rating,
                count: found ? found.count : 0,
                percentage: found ? Math.round((found.count / totalReviews) * 100) : 0,
            };
        });

        res.status(200).json({
            success: true,
            reviews,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalReviews / limit),
                totalReviews,
                hasMore: page * limit < totalReviews,
            },
            ratingDistribution: distribution,
        });
    } catch (error) {
        console.error('❌ Get reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reviews',
            error: error.message,
        });
    }
};

// @desc    Update a review
// @route   PUT /api/reviews/:id
export const updateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;

        const review = await Review.findById(id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found',
            });
        }

        // Check ownership
        if (review.studentId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this review',
            });
        }

        // Validate inputs
        if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5',
            });
        }

        if (comment && comment.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: 'Comment must be at least 10 characters',
            });
        }

        // Update review
        if (rating) review.rating = rating;
        if (comment) review.comment = comment.trim();
        review.isEdited = true;
        review.editedAt = new Date();

        await review.save();
        await review.populate('studentId', 'name profileImage');

        console.log('✅ Review updated:', review._id);

        res.status(200).json({
            success: true,
            message: 'Review updated successfully',
            review,
        });
    } catch (error) {
        console.error('❌ Update review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update review',
            error: error.message,
        });
    }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
export const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;

        const review = await Review.findById(id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found',
            });
        }

        // Check ownership
        if (review.studentId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this review',
            });
        }

        await review.remove(); // This triggers the post-remove hook

        console.log('✅ Review deleted:', id);

        res.status(200).json({
            success: true,
            message: 'Review deleted successfully',
        });
    } catch (error) {
        console.error('❌ Delete review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete review',
            error: error.message,
        });
    }
};

// @desc    Toggle helpful vote on a review
// @route   POST /api/reviews/:id/helpful
export const toggleHelpful = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const review = await Review.findById(id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found',
            });
        }

        const hasVoted = review.helpfulVotes.includes(userId);

        if (hasVoted) {
            // Remove vote
            review.helpfulVotes = review.helpfulVotes.filter(
                id => id.toString() !== userId
            );
            review.helpfulCount = Math.max(0, review.helpfulCount - 1);
        } else {
            // Add vote
            review.helpfulVotes.push(userId);
            review.helpfulCount += 1;
        }

        await review.save();

        res.status(200).json({
            success: true,
            message: hasVoted ? 'Vote removed' : 'Marked as helpful',
            helpfulCount: review.helpfulCount,
            hasVoted: !hasVoted,
        });
    } catch (error) {
        console.error('❌ Toggle helpful error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update helpful vote',
            error: error.message,
        });
    }
};

// @desc    Get user's review for a course
// @route   GET /api/reviews/my-review/:courseId
export const getMyReview = async (req, res) => {
    try {
        const { courseId } = req.params;

        const review = await Review.findOne({
            studentId: req.user.id,
            courseId,
        }).populate('studentId', 'name profileImage');

        res.status(200).json({
            success: true,
            review: review || null,
            hasReviewed: !!review,
        });
    } catch (error) {
        console.error('❌ Get my review error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch review',
            error: error.message,
        });
    }
};

// @desc    Get review statistics for a course
// @route   GET /api/reviews/stats/:courseId
export const getReviewStats = async (req, res) => {
    try {
        const { courseId } = req.params;

        const stats = await Review.calculateAverageRating(courseId);

        res.status(200).json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
            error: error.message,
        });
    }
};

// @desc    Get all reviews for a logged-in Tutor
// @route   GET /api/reviews/tutor/all
export const getTutorReviews = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const userId = req.user.id;

        // 1. Find the Tutor profile associated with the User
        const tutor = await Tutor.findOne({ userId });
        if (!tutor) {
            return res.status(404).json({ success: false, message: 'Tutor profile not found' });
        }

        // 2. Find all courses by this tutor
        const courses = await Course.find({ tutorId: tutor._id }).select('_id');
        const courseIds = courses.map(course => course._id);

        // 3. Find reviews for these courses
        const totalReviews = await Review.countDocuments({ courseId: { $in: courseIds } });

        const reviews = await Review.find({ courseId: { $in: courseIds } })
            .populate('studentId', 'name profileImage')
            .populate('courseId', 'title thumbnail') // Populate course info so tutor knows context
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            reviews,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalReviews / limit),
                totalReviews,
                hasMore: page * limit < totalReviews,
            },
        });
    } catch (error) {
        console.error('❌ Get tutor reviews error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tutor reviews', error: error.message });
    }
};

// @desc    Reply to a review (Tutor only)
// @route   POST /api/reviews/:id/reply
export const replyToReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;
        const userId = req.user.id;

        if (!comment || comment.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Reply comment is required' });
        }

        const review = await Review.findById(id);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }

        // Check if the course belongs to this tutor
        // We need to fetch the course and check the tutorId
        const course = await Course.findById(review.courseId);
        const tutor = await Tutor.findOne({ userId });

        if (!course || !tutor || course.tutorId.toString() !== tutor._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to reply to this review' });
        }

        // Add reply
        review.tutorResponse = {
            comment: comment.trim(),
            respondedAt: new Date(),
        };

        await review.save();

        // Populate specific fields to return updated object
        await review.populate('studentId', 'name profileImage');
        await review.populate('courseId', 'title');

       
        if (review.studentId) {
            await createNotification({
                userId: review.studentId._id ? review.studentId._id.toString() : review.studentId.toString(),
                type: 'review_reply', // Specific type for frontend routing
                title: '💬 New Reply from Tutor',
                message: `The tutor replied to your review on "${course.title}"`,
                data: {
                    courseId: course._id,
                    reviewId: review._id,
                    route: '/course-details' // Or wherever you want to redirect
                }
            });
           
        }
        res.status(200).json({
            success: true,
            message: 'Reply posted successfully',
            review,
        });

    } catch (error) {
        console.error('❌ Reply review error:', error);
        res.status(500).json({ success: false, message: 'Failed to post reply', error: error.message });
    }
};