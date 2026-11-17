import mongoose from 'mongoose';

const tutorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  instituteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institute',
    required: false
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category' // Made optional for auto-creation during registration
  },
  hourlyRate: {
    type: Number,
    default: 0,
    min: 0
  },
  experience: {
    type: Number,
    default: 0,
    min: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  studentsCount: {
    type: Number,
    default: 0
  },
  subjects: [{
    type: String,
    trim: true
  }],
  scheduleAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduleAppointment',
  },
  bio: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  notificationPreferences: {
    enrollment: {
      type: Boolean,
      default: true,
    },
    reviews: {
      type: Boolean,
      default: true,
    },
    summary: {
      type: Boolean,
      default: false,
    },
    promotions: {
      type: Boolean,
      default: false,
    },
  },
  blockedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  privateTeaching: {
    isEnabled: { type: Boolean, default: true },
    acceptSelfJoinRequests: { type: Boolean, default: true },
    headline: { type: String, trim: true, maxlength: 140, default: '' },
    city: { type: String, trim: true, default: '' },
  },
  payoutAccount: {
    method: {
      type: String,
      enum: ['none', 'bank_account', 'upi'],
      default: 'none',
    },
    accountHolderName: { type: String, trim: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    ifscCode: { type: String, trim: true, uppercase: true, default: '' },
    accountNumberMasked: { type: String, trim: true, default: '' },
    accountNumberEncrypted: { type: String, select: false, default: null },
    upiId: { type: String, trim: true, lowercase: true, default: '' },
    razorpayContactId: { type: String, trim: true, default: null },
    razorpayFundAccountId: { type: String, trim: true, default: null },
    razorpayLinkedAccountId: { type: String, trim: true, default: null },
    verificationStatus: {
      type: String,
      enum: ['not_configured', 'pending', 'verified', 'rejected'],
      default: 'not_configured',
      index: true,
    },
    submittedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, trim: true, default: '' },
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Tutor', tutorSchema);
