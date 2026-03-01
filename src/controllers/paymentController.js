import Razorpay from 'razorpay';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import Payment from '../models/Payment.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import { createNotification } from './notificationController.js';

// Lazy Razorpay initialization (only when payment endpoints are called)
let razorpay = null;
const getRazorpay = () => {
    if (!razorpay) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error('Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
        }
        razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpay;
};

// @desc    Create Razorpay order for course purchase
// @route   POST /api/payments/create-order
// @access  Private (Student)
export const createOrder = async (req, res) => {
    try {
        const { courseId } = req.body;

        if (!courseId) {
            return res.status(400).json({ success: false, message: 'Course ID is required' });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }

        if (course.isFree || course.price === 0) {
            return res.status(400).json({ success: false, message: 'This course is free. No payment needed.' });
        }

        // Check if already enrolled
        const existingEnrollment = await Enrollment.findOne({
            studentId: req.user.id,
            courseId,
        });
        if (existingEnrollment) {
            return res.status(400).json({ success: false, message: 'Already enrolled in this course' });
        }

        // Amount in paise (smallest currency unit)
        const amountInPaise = Math.round(course.price * 100);

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `course_${courseId}_${Date.now()}`,
            notes: {
                courseId: courseId.toString(),
                studentId: req.user.id,
                courseTitle: course.title,
            },
        };

        const order = await getRazorpay().orders.create(options);

        // Save payment record with status 'created'
        await Payment.create({
            studentId: req.user.id,
            courseId,
            amount: course.price,
            currency: 'INR',
            razorpayOrderId: order.id,
            status: 'created',
            type: 'course_purchase',
        });

        res.status(200).json({
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
            },
            key: process.env.RAZORPAY_KEY_ID,
            course: {
                title: course.title,
                price: course.price,
            },
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }
};

// @desc    Verify Razorpay payment and enroll student
// @route   POST /api/payments/verify
// @access  Private (Student)
export const verifyPayment = async (req, res) => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return res.status(400).json({ success: false, message: 'Missing payment verification details' });
        }

        // Verify signature
        const body = razorpayOrderId + '|' + razorpayPaymentId;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpaySignature) {
            // Mark as failed
            await Payment.findOneAndUpdate(
                { razorpayOrderId },
                { status: 'failed' }
            );
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        // Update payment record
        const payment = await Payment.findOneAndUpdate(
            { razorpayOrderId },
            {
                razorpayPaymentId,
                razorpaySignature,
                status: 'paid',
                paidAt: new Date(),
            },
            { new: true }
        );

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found' });
        }

        // Auto-enroll the student
        const existingEnrollment = await Enrollment.findOne({
            studentId: payment.studentId,
            courseId: payment.courseId,
        });

        if (!existingEnrollment) {
            await Enrollment.create({
                studentId: payment.studentId,
                courseId: payment.courseId,
            });

            // Update enrolled count
            await Course.findByIdAndUpdate(payment.courseId, { $inc: { enrolledCount: 1 } });

            // Notification
            const course = await Course.findById(payment.courseId);
            await createNotification({
                userId: payment.studentId,
                type: 'course_enrolled',
                title: '🎉 Payment Successful!',
                message: `You've been enrolled in "${course?.title}". Happy learning!`,
                data: { courseId: payment.courseId },
            });
        }

        res.status(200).json({
            success: true,
            message: 'Payment verified and enrollment complete',
            payment: {
                id: payment._id,
                invoiceNumber: payment.invoiceNumber,
                amount: payment.amount,
                status: payment.status,
            },
        });
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
};

// @desc    Get my payment history
// @route   GET /api/payments/my-payments
// @access  Private (Student)
export const getMyPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ studentId: req.user.id, status: 'paid' })
            .populate('courseId', 'title thumbnail price')
            .sort({ paidAt: -1 });

        res.status(200).json({
            success: true,
            payments,
        });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
};

// @desc    Generate and download PDF invoice
// @route   GET /api/payments/:id/invoice
// @access  Private (Student)
export const generateInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await Payment.findById(id)
            .populate('courseId', 'title price')
            .populate('studentId', 'name email');

        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.studentId._id.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (payment.status !== 'paid') {
            return res.status(400).json({ success: false, message: 'Invoice available only for completed payments' });
        }

        // Generate PDF
        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${payment.invoiceNumber}.pdf`);

        doc.pipe(res);

        // Header
        doc.fontSize(28).font('Helvetica-Bold').text('INVOICE', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica').fillColor('#666666')
            .text('Sapience Learning Platform', { align: 'center' });
        doc.moveDown(2);

        // Invoice Details
        doc.fillColor('#333333');
        doc.fontSize(11).font('Helvetica-Bold').text('Invoice Number:', { continued: true })
            .font('Helvetica').text(`  ${payment.invoiceNumber}`);
        doc.fontSize(11).font('Helvetica-Bold').text('Date:', { continued: true })
            .font('Helvetica').text(`  ${new Date(payment.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`);
        doc.fontSize(11).font('Helvetica-Bold').text('Payment ID:', { continued: true })
            .font('Helvetica').text(`  ${payment.razorpayPaymentId}`);
        doc.moveDown(1.5);

        // Divider
        doc.strokeColor('#e2e8f0').lineWidth(1)
            .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);

        // Bill To
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#334155').text('Bill To:');
        doc.fontSize(11).font('Helvetica').fillColor('#333333')
            .text(payment.studentId.name || 'Student')
            .text(payment.studentId.email || '');
        doc.moveDown(1.5);

        // Items Table Header
        const tableTop = doc.y;
        doc.rect(50, tableTop, 495, 25).fill('#f1f5f9');
        doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold');
        doc.text('Item', 60, tableTop + 7);
        doc.text('Type', 280, tableTop + 7);
        doc.text('Amount', 440, tableTop + 7, { align: 'right', width: 95 });
        doc.moveDown(1.5);

        // Item Row
        const rowY = doc.y;
        doc.fillColor('#333333').fontSize(10).font('Helvetica');
        doc.text(payment.courseId?.title || 'Course Purchase', 60, rowY);
        doc.text(payment.type === 'subscription_renewal' ? 'Subscription' : 'Course', 280, rowY);
        doc.text(`₹${payment.amount.toFixed(2)}`, 440, rowY, { align: 'right', width: 95 });
        doc.moveDown(2);

        // Total
        doc.strokeColor('#e2e8f0').lineWidth(0.5)
            .moveTo(350, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text(`Total: ₹${payment.amount.toFixed(2)}`, 350, doc.y, { align: 'right', width: 195 });
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica').fillColor('#16a34a')
            .text('PAID', 350, doc.y, { align: 'right', width: 195 });

        doc.moveDown(4);

        // Footer
        doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
            .text('This is a computer-generated invoice and does not require a physical signature.', { align: 'center' })
            .text('For queries, contact support@sapience.app', { align: 'center' });

        doc.end();
    } catch (error) {
        console.error('Generate invoice error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate invoice' });
    }
};

// @desc    Renew subscription (for institutes / tutors)
// @route   POST /api/payments/renew-subscription
// @access  Private
export const renewSubscription = async (req, res) => {
    try {
        const { planAmount, planName, instituteId } = req.body;

        if (!planAmount || planAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Valid plan amount is required' });
        }

        const amountInPaise = Math.round(planAmount * 100);

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `sub_${instituteId || req.user.id}_${Date.now()}`,
            notes: {
                type: 'subscription_renewal',
                planName: planName || 'Standard',
                userId: req.user.id,
                instituteId: instituteId || null,
            },
        };

        const order = await getRazorpay().orders.create(options);

        await Payment.create({
            studentId: req.user.id,
            instituteId: instituteId || null,
            amount: planAmount,
            currency: 'INR',
            razorpayOrderId: order.id,
            status: 'created',
            type: 'subscription_renewal',
        });

        res.status(200).json({
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
            },
            key: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error('Renew subscription error:', error);
        res.status(500).json({ success: false, message: 'Failed to create subscription order' });
    }
};

// @desc    Retry a failed payment
// @route   POST /api/payments/:id/retry
// @access  Private
export const retryFailedPayment = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await Payment.findById(id);
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        if (payment.studentId.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (payment.status === 'paid') {
            return res.status(400).json({ success: false, message: 'This payment is already completed' });
        }

        // Max 3 retries
        const retryCount = payment.retryCount || 0;
        if (retryCount >= 3) {
            return res.status(400).json({ success: false, message: 'Maximum retry attempts (3) reached. Please create a new order.' });
        }

        // Create a new Razorpay order
        const amountInPaise = Math.round(payment.amount * 100);
        const order = await getRazorpay().orders.create({
            amount: amountInPaise,
            currency: payment.currency || 'INR',
            receipt: `retry_${id}_${Date.now()}`,
            notes: {
                originalPaymentId: id,
                retryCount: retryCount + 1,
            },
        });

        // Update the payment record with new order
        payment.razorpayOrderId = order.id;
        payment.status = 'created';
        payment.retryCount = retryCount + 1;
        payment.lastRetryAt = new Date();
        await payment.save();

        res.status(200).json({
            success: true,
            message: `Retry ${retryCount + 1}/3 — new order created`,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
            },
            key: process.env.RAZORPAY_KEY_ID,
            retriesLeft: 3 - (retryCount + 1),
        });
    } catch (error) {
        console.error('Retry payment error:', error);
        res.status(500).json({ success: false, message: 'Failed to retry payment' });
    }
};

// @desc    Get all payments (including failed — for retry UI)
// @route   GET /api/payments/all
// @access  Private
export const getAllMyPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ studentId: req.user.id })
            .populate('courseId', 'title thumbnail price')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            payments,
        });
    } catch (error) {
        console.error('Get all payments error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
};
