import express from 'express';
import {
    createOrder,
    verifyPayment,
    getMyPayments,
    getAllMyPayments,
    generateInvoice,
    renewSubscription,
    retryFailedPayment,
} from '../controllers/paymentController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/create-order', authorize('student'), createOrder);
router.post('/verify', authorize('student'), verifyPayment);
router.get('/my-payments', authorize('student'), getMyPayments);
router.get('/all', authorize('student'), getAllMyPayments);
router.get('/:id/invoice', authorize('student'), generateInvoice);
router.post('/renew-subscription', renewSubscription);
router.post('/:id/retry', authorize('student'), retryFailedPayment);

export default router;
