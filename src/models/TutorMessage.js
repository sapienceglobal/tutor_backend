import mongoose from 'mongoose';

const tutorMessageSchema = new mongoose.Schema({
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    required: true,
    index: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null,
    index: true,
  },
  senderRole: {
    type: String,
    enum: ['tutor', 'student'],
    required: true,
    index: true,
  },
  senderUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2500,
  },
  readByRecipient: {
    type: Boolean,
    default: false,
    index: true,
  },
  sentAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, { timestamps: true });

tutorMessageSchema.index({ tutorId: 1, studentId: 1, sentAt: -1 });

export default mongoose.model('TutorMessage', tutorMessageSchema);
