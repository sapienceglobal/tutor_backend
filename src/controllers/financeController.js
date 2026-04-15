import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import { Institute } from '../models/Institute.js';

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
        const recentPayments = await Payment.find({ status: { $in: ['paid', 'failed'] } })
            .sort({ createdAt: -1 })
            .limit(6)
            .populate('studentId', 'name email')
            .populate('instituteId', 'name');

        const recentTransactions = recentPayments.map(p => ({
            transactionId: p.razorpayOrderId || p._id,
            entityName: p.instituteId?.name || p.studentId?.name || 'Unknown User',
            entityEmail: p.studentId?.email || 'N/A',
            type: p.type,
            amount: p.amount,
            status: p.status === 'paid' ? 'successful' : 'failed',
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

        // TODO: In the future, trigger your actual RazorpayX or Stripe Transfer API right here before committing the transaction.

        await session.commitTransaction();
        session.endSession();

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