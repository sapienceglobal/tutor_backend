import PayoutRequest from '../models/PayoutRequest.js';
import Tutor from '../models/Tutor.js';
import Notification from '../models/Notification.js';

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

// @desc    List tutor payout KYC accounts for SuperAdmin review
// @route   GET /api/superadmin/payouts/accounts
// @access  Private/Superadmin
export const getTutorPayoutAccounts = async (req, res) => {
    try {
        const status = String(req.query.status || 'pending').trim().toLowerCase();
        const filter = {};
        if (status !== 'all' && ['not_configured', 'pending', 'verified', 'rejected'].includes(status)) {
            filter['payoutAccount.verificationStatus'] = status;
        } else if (status === 'all') {
            filter['payoutAccount.method'] = { $in: ['bank_account', 'upi'] };
        }

        const tutors = await Tutor.find(filter)
            .populate('userId', 'name email phone profileImage')
            .select('-payoutAccount.accountNumberEncrypted')
            .sort({ 'payoutAccount.submittedAt': -1, updatedAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            accounts: tutors.map((t) => ({
                tutorId: t._id,
                userId: t.userId,
                subjects: t.subjects || [],
                payoutAccount: t.payoutAccount || { verificationStatus: 'not_configured', method: 'none' },
            })),
        });
    } catch (error) {
        console.error('Get tutor payout accounts error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch tutor payout accounts' });
    }
};

// @desc    SuperAdmin verifies or rejects a Tutor's payout account (& optionally attaches Razorpay Route linked account ID)
// @route   PATCH /api/superadmin/payouts/accounts/:tutorId/verify
// @access  Private/Superadmin
export const verifyTutorPayoutAccount = async (req, res) => {
    try {
        const { tutorId } = req.params;
        const { status, rejectionReason, razorpayLinkedAccountId, razorpayContactId, razorpayFundAccountId } = req.body;

        if (!['verified', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status must be verified or rejected' });
        }

        const tutor = await Tutor.findById(tutorId).select('-payoutAccount.accountNumberEncrypted');
        if (!tutor) {
            return res.status(404).json({ success: false, message: 'Tutor not found' });
        }

        if (!tutor.payoutAccount || tutor.payoutAccount.method === 'none') {
            return res.status(400).json({ success: false, message: 'Tutor has not submitted payout account details yet' });
        }

        tutor.payoutAccount.verificationStatus = status;
        tutor.payoutAccount.verifiedBy = req.user.id;
        tutor.payoutAccount.verifiedAt = status === 'verified' ? new Date() : null;
        tutor.payoutAccount.rejectionReason = status === 'rejected' ? String(rejectionReason || 'Verification rejected').trim() : '';

        if (razorpayLinkedAccountId !== undefined) {
            tutor.payoutAccount.razorpayLinkedAccountId = String(razorpayLinkedAccountId || '').trim() || null;
        }
        if (razorpayContactId !== undefined) {
            tutor.payoutAccount.razorpayContactId = String(razorpayContactId || '').trim() || null;
        }
        if (razorpayFundAccountId !== undefined) {
            tutor.payoutAccount.razorpayFundAccountId = String(razorpayFundAccountId || '').trim() || null;
        }

        await tutor.save();

        await Notification.create({
            userId: tutor.userId,
            type: status === 'verified' ? 'payout_account_verified' : 'payout_account_rejected',
            title: status === 'verified' ? 'Payout Account Verified!' : 'Payout Account Needs Attention',
            message: status === 'verified'
                ? 'Your bank/UPI payout account is verified. Online Razorpay fee collection is now unlocked for your paid courses!'
                : `Your payout account verification was rejected: ${tutor.payoutAccount.rejectionReason}`,
            data: { tutorId: tutor._id },
        }).catch(() => {});

        res.status(200).json({
            success: true,
            message: `Tutor payout account ${status}`,
            payoutAccount: tutor.payoutAccount,
        });
    } catch (error) {
        console.error('Verify tutor payout account error:', error);
        res.status(500).json({ success: false, message: 'Failed to update payout verification status' });
    }
};