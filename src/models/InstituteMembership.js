import mongoose from 'mongoose';
import crypto from 'crypto';

const instituteMembershipSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  instituteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institute',
    required: true,
    index: true
  },
  roleInInstitute: {
    type: String,
    enum: ['student', 'tutor', 'admin'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'rejected'],
    default: 'pending',
    index: true
  },
  joinedVia: {
    type: String,
    enum: ['invite', 'self_request', 'subdomain', 'admin_add', 'system_created'],
    required: true
  },
  inviteToken: {
    type: String,
    sparse: true,
    unique: true,
    index: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  rejectionReason: {
    type: String,
    trim: true,
    default: ''
  },
  requestedBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    default: null
  },
  requestMessage: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  permissions: {
    canCreateCourses: { type: Boolean, default: false },
    canCreateExams: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: false },
    canManageStudents: { type: Boolean, default: false },
    custom: [{ type: String }]
  },
  metadata: {
    department: String,
    batch: String,
    rollNumber: String,
    enrollmentId: String,
    suspensionReason: String
  }
}, {
  timestamps: true
});

// Proper compound indexes for membership queries
instituteMembershipSchema.index({ userId: 1, instituteId: 1 }, { unique: true });
instituteMembershipSchema.index({ instituteId: 1, status: 1, roleInInstitute: 1 });
instituteMembershipSchema.index({ userId: 1, status: 1 });
instituteMembershipSchema.index({ inviteToken: 1, status: 1 });

// Static methods
instituteMembershipSchema.statics = {
  async findActiveMemberships(userId) {
    return this.find({ 
      userId, 
      status: 'active' 
    }).populate('instituteId', 'name subdomain logo isActive');
  },

  async findInstituteMembers(instituteId, status = 'active') {
    return this.find({ 
      instituteId, 
      status 
    }).populate('userId', 'name email avatar')
     .populate('approvedBy', 'name');
  },

  async getInstituteMembers(instituteId, options = {}) {
    const { status = 'active', role } = options;
    const query = { instituteId, status };
    if (role) {
      query.roleInInstitute = role;
    }
    return this.find(query)
      .populate('userId', 'name email avatar profileImage role')
      .populate('approvedBy', 'name');
  },

  async findByInviteToken(token) {
    return this.findOne({ 
      inviteToken: token, 
      status: 'pending' 
    }).populate('instituteId userId');
  },

  async checkMembership(userId, instituteId, requiredRole = null) {
    const query = { userId, instituteId, status: 'active' };
    if (requiredRole) query.roleInInstitute = requiredRole;
    
    return this.findOne(query).populate('instituteId');
  }
};

// Instance methods
instituteMembershipSchema.methods = {
  async approve(approvedBy) {
    this.status = 'active';
    this.approvedBy = approvedBy;
    this.approvedAt = new Date();
    this.rejectedBy = null;
    this.rejectedAt = null;
    this.rejectionReason = '';
    return this.save();
  },

  async reject(rejectedBy, reason = '') {
    this.status = 'rejected';
    this.rejectedBy = rejectedBy;
    this.rejectedAt = new Date();
    this.rejectionReason = String(reason || '').trim();
    return this.save();
  },

  async suspend(reason) {
    this.status = 'suspended';
    this.metadata.suspensionReason = reason;
    return this.save();
  },

  updateLastActive() {
    this.lastActiveAt = new Date();
    return this.save();
  },

  hasPermission(permission) {
    return this.permissions[permission] === true;
  },

  generateInviteToken() {
    return crypto.randomBytes(32).toString('hex');
  }
};

// Pre-save middleware
instituteMembershipSchema.pre('save', function() {
  if (this.isNew && this.joinedVia === 'invite' && !this.inviteToken) {
    this.inviteToken = this.generateInviteToken();
  }
});

export default mongoose.model('InstituteMembership', instituteMembershipSchema);
