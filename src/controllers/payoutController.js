import PayoutRequest from '../models/PayoutRequest.js';
import Tutor from '../models/Tutor.js';
import { logAdminAction } from '../utils/logger.js';

// @desc    Tutor requests a payout
// @route   POST /api/tutors/payouts/request
// @access  Private (Tutor only)
export const requestPayout = async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;

    // Validate
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid payout amount' });
    }

    if (!bankDetails || !bankDetails.accountNumber) {
      return res.status(400).json({ success: false, message: 'Bank details are required' });
    }

    // Find the tutor
    const tutor = await Tutor.findOne({ userId: req.user.id });
    if (!tutor) {
      return res.status(404).json({ success: false, message: 'Tutor profile not found' });
    }

    // Check if there's enough balance (Assuming wallet/earnings balance logic later. For now we just create the request)
    // In a full implementation, you'd check `tutor.balance >= amount`. 
    // We'll trust the requested amount or add a balance field to the Tutor schema if needed.
    
    // Check if there's already a pending request
    const existingPending = await PayoutRequest.findOne({ tutorId: tutor._id, status: 'pending' });
    if (existingPending) {
      return res.status(400).json({ success: false, message: 'You already have a pending payout request' });
    }

    const payout = await PayoutRequest.create({
      tutorId: tutor._id,
      amount,
      bankDetails
    });

    res.status(201).json({ success: true, payout, message: 'Payout requested successfully' });
  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get tutor's payout history
// @route   GET /api/tutors/payouts
// @access  Private (Tutor only)
export const getMyPayouts = async (req, res) => {
  try {
    const tutor = await Tutor.findOne({ userId: req.user.id });
    if (!tutor) {
      return res.status(404).json({ success: false, message: 'Tutor profile not found' });
    }

    const payouts = await PayoutRequest.find({ tutorId: tutor._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, payouts });
  } catch (error) {
    console.error('Get my payouts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin gets all payout requests
// @route   GET /api/admin/payouts
// @access  Private (Admin only)
export const getAllPayouts = async (req, res) => {
  try {
    const payouts = await PayoutRequest.find()
      .populate({
        path: 'tutorId',
        populate: { path: 'userId', select: 'name email profileImage' }
      })
      .sort({ createdAt: -1 });
      
    res.status(200).json({ success: true, payouts });
  } catch (error) {
    console.error('Get all payouts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Admin updates a payout request status
// @route   PUT /api/admin/payouts/:id
// @access  Private (Admin only)
export const updatePayoutStatus = async (req, res) => {
  try {
    const { status, adminNotes, transactionId } = req.body;
    
    if (!['processing', 'paid', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const payout = await PayoutRequest.findById(req.params.id);
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout request not found' });
    }

    payout.status = status;
    if (adminNotes) payout.adminNotes = adminNotes;
    if (status === 'paid') {
      payout.processedDate = Date.now();
      if (transactionId) payout.transactionId = transactionId;
      // Ideally, subtract the amount from the tutor's actual wallet balance here.
    }

    await payout.save();

    // Audit Log
    await logAdminAction(req.user.id, 'PROCESS_PAYOUT', 'payout', payout._id, { status, amount: payout.amount, tutorId: payout.tutorId });

    res.status(200).json({ success: true, payout, message: `Payout marked as ${status}` });
  } catch (error) {
    console.error('Update payout error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
