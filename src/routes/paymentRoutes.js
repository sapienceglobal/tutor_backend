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
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/create-order', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.get('/my-payments', protect, getMyPayments);
router.get('/all', protect, getAllMyPayments);
router.get('/:id/invoice', protect, generateInvoice);
router.post('/renew-subscription', protect, renewSubscription);
router.post('/:id/retry', protect, retryFailedPayment);

export default router;
