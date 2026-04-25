import PayoutRequest from '../models/PayoutRequest.js';

// @desc    Get all payout requests & financial KPIs (God View)
// @route   GET /api/superadmin/payouts
// @access  Private/Superadmin
export const getGlobalPayouts = async (req, res) => {
    try {
        const { status } = req.query;

        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        // Fetch requests (Populating tutor info, assuming tutor ref points to a User/Tutor collection with name & email)
        let payouts = await PayoutRequest.find(query)
            .populate({
                path: 'tutorId',
                populate: {
                    path: 'userId',
                    select: 'name email profileImage'
                }
            })
            .sort({ createdAt: -1 });

        // Map userId fields to tutorId to match frontend expectations
        payouts = payouts.map(payout => {
            const payoutObj = payout.toObject();
            if (payoutObj.tutorId && payoutObj.tutorId.userId) {
                payoutObj.tutorId.name = payoutObj.tutorId.userId.name;
                payoutObj.tutorId.email = payoutObj.tutorId.userId.email;
                payoutObj.tutorId.profileImage = payoutObj.tutorId.userId.profileImage;
            }
            return payoutObj;
        });

        // Calculate Real KPIs directly from DB
        const pendingAgg = await PayoutRequest.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]);

        const paidAgg = await PayoutRequest.aggregate([
            { $match: { status: 'paid' } },
            { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]);

        const processingCount = await PayoutRequest.countDocuments({ status: 'processing' });

        res.status(200).json({
            success: true,
            data: {
                payouts,
                kpis: {
                    pendingAmount: pendingAgg[0]?.totalAmount || 0,
                    pendingCount: pendingAgg[0]?.count || 0,
                    paidAmount: paidAgg[0]?.totalAmount || 0,
                    paidCount: paidAgg[0]?.count || 0,
                    processingCount
                }
            }
        });
    } catch (error) {
        console.error('Superadmin Fetch Payouts Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payout requests' });
    }
};

// @desc    Process a payout (Mark as Processing, Paid, or Rejected)
// @route   PATCH /api/superadmin/payouts/:id/process
// @access  Private/Superadmin
export const processPayout = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, transactionId, adminNotes } = req.body;

        const validStatuses = ['pending', 'processing', 'paid', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status provided' });
        }

        let updateData = { status };
        
        // If status changes to paid/rejected, record the timestamp
        if (status === 'paid' || status === 'rejected') {
            updateData.processedDate = new Date();
        }

        if (transactionId !== undefined) updateData.transactionId = transactionId;
        if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

        const payout = await PayoutRequest.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('tutorId', 'name email');

        if (!payout) {
            return res.status(404).json({ success: false, message: 'Payout request not found' });
        }

        res.status(200).json({
            success: true,
            message: `Payout successfully marked as ${status.toUpperCase()}`,
            data: payout
        });
    } catch (error) {
        console.error('Process Payout Error:', error);
        res.status(500).json({ success: false, message: 'Failed to process payout request' });
    }
};