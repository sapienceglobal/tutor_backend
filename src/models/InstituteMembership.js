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
    enrollmentId: String
  }
}, {
  timestamps: true,
  compoundIndexes: [
    { userId: 1, instituteId: 1 }, // Unique membership per user per institute
    { instituteId: 1, status: 1 }, // Institute member listings
    { userId: 1, status: 1 }, // User's active memberships
    { inviteToken: 1, status: 1 } // Invite tracking
  ]
});

// Ensure one membership per user per institute
instituteMembershipSchema.index({ userId: 1, instituteId: 1 }, { unique: true });

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
