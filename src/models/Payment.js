import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        default: null,
    },
    // For institute subscription renewals
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        default: null,
    },
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
        default: null,
    },
    type: {
        type: String,
        enum: ['course_purchase', 'subscription_renewal', 'institute_fee'],
        default: 'course_purchase',
    },
    title: {
        type: String,
        default: null,
    },
    dueDate: {
        type: Date,
        default: null,
    },
    amount: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'INR',
    },
    razorpayOrderId: {
        type: String,
        required: true,
    },
    razorpayPaymentId: {
        type: String,
        default: null,
    },
    razorpaySignature: {
        type: String,
        default: null,
    },
    status: {
        type: String,
        enum: ['created', 'paid', 'failed', 'refunded'],
        default: 'created',
    },
    invoiceNumber: {
        type: String,
        unique: true,
        sparse: true,
    },
    retryCount: {
        type: Number,
        default: 0,
    },
    lastRetryAt: {
        type: Date,
        default: null,
    },
    paidAt: {
        type: Date,
        default: null,
    },
    // --- FINANCIAL SETTLEMENT FIELDS (NEW) ---
    platformFee: {
        type: Number,
        default: 0,
        // Platform ka commission (e.g., 10% of amount)
    },
    instituteEarnings: {
        type: Number,
        default: 0,
        // Institute ka actual cut (amount - platformFee)
    },
    isSettled: {
        type: Boolean,
        default: false,
        // True agar Superadmin ne institute ko ye paisa bank me bhej diya hai
    },
    settledAt: {
        type: Date,
        default: null,
        // Payout kab kiya tha
    },
    payoutReferenceId: {
        type: String,
        default: null,
        // RazorpayX ya bank transfer ka transaction ID jab settlement kiya
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Auto-generate invoice number on payment success
paymentSchema.pre('save', function (next) {
    if (this.isModified('status') && this.status === 'paid' && !this.invoiceNumber) {
        const date = new Date();
        const prefix = 'INV';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        this.invoiceNumber = `${prefix}-${year}${month}-${random}`;
        this.paidAt = date;
    }
    next();
});

export default mongoose.model('Payment', paymentSchema);
