import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
  },
  enrolledAt: {
    type: Date,
    default: Date.now,
  },
  progress: {
    completedLessons: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
    }],
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  status: {
    type: String,
    enum: ['pending', 'pending_payment', 'active', 'completed', 'dropped'],
    default: 'active',
  },
  paymentMode: {
    type: String,
    enum: ['free', 'offline', 'online'],
    default: 'free',
  },
  offlinePayment: {
    receiptNote: { type: String, trim: true, default: '' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
  },
  lastAccessed: {
    type: Date,
    default: Date.now,
  },
  completedAt: Date,
});

// Compound index to prevent duplicate enrollments
enrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

export default mongoose.model('Enrollment', enrollmentSchema);