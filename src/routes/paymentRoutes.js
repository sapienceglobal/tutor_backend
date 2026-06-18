import express from 'express';
import {
    createOrder,
    verifyPayment,
    getMyPayments,
    getAllMyPayments,
    generateInvoice,
    renewSubscription,
    retryFailedPayment,
    handleRazorpayWebhook,
} from '../controllers/paymentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public route for Razorpay webhook (unauthenticated)
router.post('/webhook', handleRazorpayWebhook);

router.use(protect);

router.post('/create-order', authorize('student'), createOrder);
router.post('/verify', authorize('student', 'admin', 'tutor'), verifyPayment);
router.get('/my-payments', authorize('student'), getMyPayments);
router.get('/all', authorize('student'), getAllMyPayments);
router.get('/:id/invoice', authorize('student'), generateInvoice);
router.post('/renew-subscription', authorize('admin', 'tutor', 'student'), renewSubscription);
router.post('/:id/retry', authorize('student'), retryFailedPayment);

export default router;
