import express from 'express';
const router = express.Router();
import { protect } from '../middleware/auth.js';
import { addToWishlist, removeFromWishlist, getWishlist, checkWishlistStatus } from '../controllers/wishlistController.js';

router.use(protect); // All wishlist routes require authentication

router.route('/')
    .get(getWishlist)
    .post(addToWishlist);

router.delete('/:courseId', removeFromWishlist);
router.get('/:courseId/status', checkWishlistStatus);

export default router;
