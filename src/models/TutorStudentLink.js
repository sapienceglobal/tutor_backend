import mongoose from 'mongoose';

const tutorStudentLinkSchema = new mongoose.Schema({
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    required: true,
    index: true,
  },
  tutorUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'rejected', 'suspended'],
    default: 'pending',
    index: true,
  },
  initiatedBy: {
    type: String,
    enum: ['student', 'tutor', 'admin_migration'],
    default: 'student',
  },
  requestMessage: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  },
  subjects: [{
    type: String,
    trim: true,
  }],
  approvedAt: {
    type: Date,
    default: null,
  },
  rejectedAt: {
    type: Date,
    default: null,
  },
  rejectionReason: {
    type: String,
    trim: true,
    default: '',
  },
  suspendedAt: {
    type: Date,
    default: null,
  },
  suspensionReason: {
    type: String,
    trim: true,
    default: '',
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// One private tuition relationship document per tutor-student pair
tutorStudentLinkSchema.index({ tutorId: 1, studentId: 1 }, { unique: true });
tutorStudentLinkSchema.index({ tutorUserId: 1, status: 1 });
tutorStudentLinkSchema.index({ studentId: 1, status: 1 });
tutorStudentLinkSchema.index({ tutorId: 1, status: 1 });

tutorStudentLinkSchema.statics = {
  async findActiveTutorsForStudent(studentId) {
    return this.find({ studentId, status: 'active' })
      .populate('tutorId', 'subjects bio title rating experience hourlyRate privateTeaching payoutAccount.verificationStatus')
      .populate('tutorUserId', 'name email avatar profileImage')
      .sort({ approvedAt: -1, createdAt: -1 });
  },

  async findStudentsForTutor(tutorId, status = 'active') {
    const query = { tutorId };
    if (status) {
      query.status = status;
    }
    return this.find(query)
      .populate('studentId', 'name email avatar profileImage phone isVerified')
      .sort({ createdAt: -1 });
  },

  async checkLink(tutorId, studentId) {
    return this.findOne({ tutorId, studentId, status: 'active' });
  },

  async checkLinkByUserIds(tutorUserId, studentId) {
    return this.findOne({ tutorUserId, studentId, status: 'active' });
  },
};

tutorStudentLinkSchema.methods = {
  async approve() {
    this.status = 'active';
    this.approvedAt = new Date();
    this.rejectedAt = null;
    this.rejectionReason = '';
    this.suspendedAt = null;
    this.suspensionReason = '';
    return this.save();
  },

  async reject(reason = '') {
    this.status = 'rejected';
    this.rejectedAt = new Date();
    this.rejectionReason = String(reason || '').trim();
    return this.save();
  },

  async suspend(reason = '') {
    this.status = 'suspended';
    this.suspendedAt = new Date();
    this.suspensionReason = String(reason || '').trim();
    return this.save();
  },
};

export default mongoose.models.TutorStudentLink
  || mongoose.model('TutorStudentLink', tutorStudentLinkSchema);

