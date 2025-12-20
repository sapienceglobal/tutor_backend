import express from 'express';
import {
    createReview,
    getCourseReviews,
    updateReview,
    deleteReview,
    toggleHelpful,
    getMyReview,
    getReviewStats,
    getTutorReviews,
    replyToReview,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Public routes (anyone can view reviews)
router.get('/course/:courseId', getCourseReviews);
router.get('/stats/:courseId', getReviewStats);

// Protected routes (require authentication)
router.use(protect); // All routes below require authentication

router.post('/', createReview);
router.get('/my-review/:courseId', getMyReview);
router.put('/:id', updateReview);
router.delete('/:id', deleteReview);
router.post('/:id/helpful', toggleHelpful);

// Add these lines
router.get('/tutor/all', protect, getTutorReviews);
router.post('/:id/reply', protect, replyToReview);

export default router;