import mongoose from 'mongoose';

const examReevaluationRequestSchema = new mongoose.Schema({
  attemptId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExamAttempt',
    required: true,
    unique: true,
    index: true,
  },
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null,
    index: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    minlength: 15,
    maxlength: 1000,
  },
  originalScore: {
    type: Number,
    default: 0,
  },
  originalPercentage: {
    type: Number,
    default: 0,
  },
  originalPassed: {
    type: Boolean,
    default: false,
  },
  revisedScore: {
    type: Number,
    default: null,
  },
  revisedPercentage: {
    type: Number,
    default: null,
  },
  revisedPassed: {
    type: Boolean,
    default: null,
  },
  tutorRemarks: {
    type: String,
    trim: true,
    maxlength: 1200,
    default: '',
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

examReevaluationRequestSchema.index({ tutorId: 1, status: 1, createdAt: -1 });
examReevaluationRequestSchema.index({ studentId: 1, createdAt: -1 });
examReevaluationRequestSchema.index({ examId: 1, createdAt: -1 });

export default mongoose.model('ExamReevaluationRequest', examReevaluationRequestSchema);
