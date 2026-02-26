import mongoose from 'mongoose';

const payoutRequestSchema = new mongoose.Schema({
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'rejected'],
    default: 'pending'
  },
  bankDetails: {
    accountHolderName: String,
    accountNumber: String,
    bankName: String,
    ifscCode: String,
    upiId: String
  },
  processedDate: {
    type: Date
  },
  adminNotes: {
    type: String
  },
  transactionId: {
    type: String
  }
}, { timestamps: true });

const PayoutRequest = mongoose.model('PayoutRequest', payoutRequestSchema);
export default PayoutRequest;
