import mongoose from 'mongoose';
import crypto from 'crypto';

const inviteSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        index: true
    },
    role: {
        type: String,
        enum: ['student', 'tutor'],
        required: [true, 'Role is required']
    },
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        required: [true, 'Institute ID is required'],
        index: true
    },
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'expired', 'revoked'],
        default: 'pending',
        index: true
    },
    expiresAt: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    acceptedAt: {
        type: Date,
        default: null
    },
    acceptedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    resendCount: {
        type: Number,
        default: 0
    },
    lastResentAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
inviteSchema.index({ instituteId: 1, status: 1 });
inviteSchema.index({ email: 1, instituteId: 1 });
inviteSchema.index({ token: 1, status: 1 });

// Virtual for checking if invite is expired
inviteSchema.virtual('isExpired').get(function() {
    return new Date() > this.expiresAt;
});

// Pre-save middleware to generate secure token
inviteSchema.pre('save', function(next) {
    if (this.isNew && !this.token) {
        // Generate secure random token (32 bytes = 64 hex chars)
        this.token = crypto.randomBytes(32).toString('hex');
    }
    next();
});

// Static method to find valid invite
inviteSchema.statics.findValidInvite = function(token) {
    return this.findOne({
        token,
        status: 'pending',
        expiresAt: { $gt: new Date() }
    }).populate('instituteId', 'name subdomain logo brandColors')
     .populate('invitedBy', 'name email');
};

// Static method to find invite by email and institute
inviteSchema.statics.findByEmailAndInstitute = function(email, instituteId) {
    return this.findOne({
        email: email.toLowerCase(),
        instituteId,
        status: { $in: ['pending', 'accepted'] }
    });
};

// Instance method to accept invite
inviteSchema.methods.acceptInvite = function(userId) {
    return this.constructor.findByIdAndUpdate(
        this._id,
        {
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedBy: userId
        },
        { new: true }
    );
};

// Instance method to revoke invite
inviteSchema.methods.revokeInvite = function() {
    return this.constructor.findByIdAndUpdate(
        this._id,
        { status: 'revoked' },
        { new: true }
    );
};

// Instance method to mark as expired
inviteSchema.methods.markAsExpired = function() {
    return this.constructor.findByIdAndUpdate(
        this._id,
        { status: 'expired' },
        { new: true }
    );
};

export default mongoose.model('Invite', inviteSchema);
