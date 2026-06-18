import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import Payment from '../models/Payment.js';
import { Institute } from '../models/Institute.js';
import { logBillingEvent } from '../utils/billingLogger.js';

// Lazy Razorpay initialization
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

// @desc    Get Superadmin Finance Overview (Live Exact Aggregation)
// @route   GET /api/superadmin/finance/overview
// @access  Private/Superadmin
export const getFinanceOverview = async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
        const sixtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 60));

        // ─── 1. KPIs Calculation (100% Real DB Aggregations) ───

        // A. Total Platform Volume (Sum of all amounts processed)
        const totalRevenueAgg = await Payment.aggregate([
            { $match: { status: 'paid' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const totalRevenue = totalRevenueAgg.length > 0 ? totalRevenueAgg[0].total : 0;

        // B. Platform Commission / SaaS Earnings (Exact sum of platformFee)
        const platformCommissionAgg = await Payment.aggregate([
            { $match: { status: 'paid' } },
            { $group: { _id: null, total: { $sum: "$platformFee" } } }
        ]);
        const platformCommission = platformCommissionAgg.length > 0 ? platformCommissionAgg[0].total : 0;

        // C. MRR (Monthly Recurring Revenue - Platform fees from last 30 days)
        const mrrAgg = await Payment.aggregate([
            { 
                $match: { 
                    status: 'paid', 
                    paidAt: { $gte: thirtyDaysAgo }
                } 
            },
            { $group: { _id: null, total: { $sum: "$platformFee" } } }
        ]);
        const mrr = mrrAgg.length > 0 ? mrrAgg[0].total : 0;

        // D. Growth Percentage (Current 30 days vs Previous 30 days MRR)
        const prevMrrAgg = await Payment.aggregate([
            { 
                $match: { 
                    status: 'paid', 
                    paidAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
                } 
            },
            { $group: { _id: null, total: { $sum: "$platformFee" } } }
        ]);
        const prevMrr = prevMrrAgg.length > 0 ? prevMrrAgg[0].total : 0;
        
        let growth = 0;
        if (prevMrr === 0 && mrr > 0) growth = 100;
        else if (prevMrr > 0) {
            growth = ((mrr - prevMrr) / prevMrr) * 100;
        }

        // E. Pending Payouts (Sum of instituteEarnings where isSettled is FALSE)
        const pendingPayoutsAgg = await Payment.aggregate([
            { $match: { status: 'paid', isSettled: false, instituteId: { $ne: null } } },
            { $group: { _id: null, total: { $sum: "$instituteEarnings" } } }
        ]);
        const pendingPayouts = pendingPayoutsAgg.length > 0 ? pendingPayoutsAgg[0].total : 0;

        // ─── 2. Chart Data (Last 6 Months Revenue Volume) ───
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const chartAgg = await Payment.aggregate([
            { $match: { status: 'paid', paidAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { month: { $month: "$paidAt" }, year: { $year: "$paidAt" } },
                    revenue: { $sum: "$amount" } // You can change this to $platformFee if you only want to see your cut in the chart
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const chartData = chartAgg.map(item => ({
            month: `${monthNames[item._id.month - 1]}`,
            revenue: item.revenue
        }));

        // ─── 3. Recent Transactions ───
        const recentPayments = await Payment.find({ status: { $in: ['paid', 'failed', 'refunded'] } })
            .sort({ createdAt: -1 })
            .limit(6)
            .populate('studentId', 'name email')
            .populate('instituteId', 'name');

        const recentTransactions = recentPayments.map(p => ({
            id: p._id,
            transactionId: p.razorpayOrderId || p._id,
            entityName: p.instituteId?.name || p.studentId?.name || 'Unknown User',
            entityEmail: p.studentId?.email || 'N/A',
            type: p.type,
            amount: p.amount,
            status: p.status === 'paid' ? 'successful' : p.status === 'refunded' ? 'refunded' : 'failed',
            createdAt: p.createdAt
        }));

        // ─── 4. Pending Settlements (Grouped by Exact Unsettled Institute Dues) ───
        const settlementsAgg = await Payment.aggregate([
            { $match: { status: 'paid', isSettled: false, instituteId: { $ne: null } } },
            { 
                $group: { 
                    _id: "$instituteId", 
                    totalAmount: { $sum: "$instituteEarnings" } 
                } 
            },
            { $match: { totalAmount: { $gt: 0 } } }, // Only show if they actually have money owed
            { $sort: { totalAmount: -1 } },
            { $limit: 10 }
        ]);

        // Populate institute names
        const pendingSettlements = await Promise.all(settlementsAgg.map(async (s) => {
            const inst = await Institute.findById(s._id).select('name');
            return {
                instituteId: s._id,
                instituteName: inst ? inst.name : 'Unknown Institute',
                amount: s.totalAmount
            };
        }));

        // ─── Send Final Response ───
        res.status(200).json({
            success: true,
            data: {
                kpis: {
                    totalRevenue,
                    mrr,
                    platformCommission,
                    pendingPayouts,
                    growth: parseFloat(growth.toFixed(1))
                },
                chartData,
                recentTransactions,
                pendingSettlements
            }
        });

    } catch (error) {
        console.error('Finance Overview Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch finance overview'
        });
    }
};

// @desc    Process Payout & Mark as Settled
// @route   POST /api/superadmin/finance/payouts/:instituteId
// @access  Private/Superadmin
export const processPayout = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { instituteId } = req.params;
        const payoutReference = `PAYOUT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // 1. Find all unsettled payments for this institute
        const unsettledPayments = await Payment.find({
            instituteId,
            status: 'paid',
            isSettled: false
        }).session(session);

        if (unsettledPayments.length === 0) {
            return res.status(400).json({ success: false, message: 'No pending payouts for this institute.' });
        }

        // 2. Mark them all as settled
        await Payment.updateMany(
            { instituteId, status: 'paid', isSettled: false },
            { 
                $set: { 
                    isSettled: true, 
                    settledAt: new Date(),
                    payoutReferenceId: payoutReference // Use actual RazorpayX/Stripe ID here later
                } 
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        // Log payout processed event
        await logBillingEvent(req.user.id, 'BILLING_PAYOUT_PROCESSED', {
            instituteId,
            payoutReferenceId: payoutReference,
            actorId: req.user.id
        });

        res.status(200).json({
            success: true,
            message: 'Payout processed & recorded successfully!'
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Process Payout Error:', error);
        res.status(500).json({ success: false, message: 'Failed to process payout' });
    }
};

// @desc    Issue Refund & Revoke Access (Razorpay integration)
// @route   POST /api/superadmin/finance/refund/:paymentId
// @access  Private/Superadmin
export const refundPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { reason } = req.body;

        const payment = await Payment.findById(paymentId);
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment record not found.' });
        }

        if (payment.status !== 'paid') {
            return res.status(400).json({ success: false, message: `Only paid transactions can be refunded. Current status is '${payment.status}'.` });
        }

        if (!payment.razorpayPaymentId) {
            return res.status(400).json({ success: false, message: 'No Razorpay payment ID associated with this transaction.' });
        }

        // 1. Call Razorpay API to issue the actual refund
        const refund = await getRazorpay().payments.refund(payment.razorpayPaymentId, {
            amount: Math.round(payment.amount * 100), // Refund full amount
            notes: {
                reason: reason || 'Superadmin Initiated Refund',
                paymentId: paymentId
            }
        });

        // 2. Update payment status in database
        payment.status = 'refunded';
        await payment.save();

        // 3. Revoke active privileges based on type
        if (payment.type === 'course_purchase' && payment.courseId) {
            const Enrollment = mongoose.model('Enrollment');
            await Enrollment.findOneAndUpdate(
                { studentId: payment.studentId, courseId: payment.courseId },
                { $set: { status: 'dropped' } }
            );
        } else if (payment.type === 'subscription_renewal') {
            if (payment.instituteId) {
                // Revoke institute active plan
                await Institute.findByIdAndUpdate(payment.instituteId, {
                    $set: {
                        subscriptionPlan: 'free',
                        subscriptionExpiresAt: new Date(),
                        "features.hlsStreaming": false,
                        "features.customBranding": false,
                        "features.zoomIntegration": false,
                        "features.aiFeatures": false,
                        "features.aiAssistant": false,
                        "features.aiAssessment": false,
                        "features.aiIntelligence": false,
                        "features.customDomain": false,
                        "features.advancedAnalytics": false,
                        "features.apiAccess": false
                    }
                });
            } else {
                // Revoke personal plan
                const User = mongoose.model('User');
                await User.findByIdAndUpdate(payment.studentId, {
                    $set: {
                        "personalSubscription.isActive": false,
                        "personalSubscription.planName": "Free",
                        "personalSubscription.subscriptionExpiresAt": new Date()
                    }
                });
            }
        }

        // 4. Send notification
        const Notification = mongoose.model('Notification');
        await Notification.create({
            userId: payment.studentId,
            type: 'fee_paid',
            title: '💰 Payment Refunded Successfully',
            message: `Your payment of ₹${payment.amount} has been refunded to your original payment source.`
        });

        // Log refund event
        await logBillingEvent(req.user.id, 'BILLING_REFUND_ISSUED', {
            paymentId: payment._id,
            amount: payment.amount,
            type: payment.type,
            reason: reason || 'Superadmin Initiated Refund',
            refundId: refund.id,
            actorId: req.user.id
        });

        res.status(200).json({
            success: true,
            message: 'Refund issued successfully through Razorpay and access has been revoked.',
            refundId: refund.id
        });
    } catch (error) {
        console.error('Refund request error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.description || error.message || 'Failed to issue refund via Razorpay' 
        });
    }
};