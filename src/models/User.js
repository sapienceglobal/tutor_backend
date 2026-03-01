import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    minlength: 6,
    select: false
  },
  phone: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['student', 'tutor', 'admin', 'superadmin'],
    default: 'student'
  },
  instituteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institute',
    default: null
  },
  authProvider: {
    type: String,
    enum: ['local', 'google', 'github'],
    default: 'local'
  },
  providerId: {
    type: String,
    default: null
  },
  profileImage: {
    type: String,
    default: 'https://via.placeholder.com/150'
  },
  cloudinaryId: {
    type: String,
    default: null
  },
  language: {
    type: String,
    enum: ['en', 'hi'],
    default: 'en'
  },
  notificationSettings: {
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    }
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  bio: {
    type: String,
    maxLength: 500,
    default: ''
  },
  address: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: '' }
  },
  passwordResetOTP: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetTokenExpires: {
    type: Date,
    select: false
  },

  // --- 2FA ---
  twoFactorSecret: {
    type: String,
    select: false,
    default: null,
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },

  // --- Session Management ---
  activeSessions: [{
    token: { type: String, required: true },
    device: { type: String, default: 'Unknown' },
    ip: { type: String, default: '' },
    browser: { type: String, default: '' },
    lastActive: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
  }],

  // --- Refresh Token ---
  refreshToken: {
    type: String,
    select: false,
    default: null,
  },
}, {
  timestamps: true
});

// Password compare method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
