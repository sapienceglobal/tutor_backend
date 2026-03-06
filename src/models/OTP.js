import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    otp: {
        type: String,
        required: true,
        minlength: 6,
        maxlength: 6
    },
    purpose: {
        type: String,
        required: true,
        enum: ['invite-registration', 'email-verification', 'password-reset']
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        expires: 600 // 10 minutes expiry - this automatically creates an index
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    attempts: {
        type: Number,
        default: 0
    },
    maxAttempts: {
        type: Number,
        default: 3
    }
}, {
    timestamps: true
});

// Index for faster queries
otpSchema.index({ email: 1, purpose: 1, isUsed: 1 });
// Note: expiresAt field has 'expires: 600' which automatically creates TTL index

// Static method to generate OTP
otpSchema.statics.generateOTP = function() {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Static method to create and send OTP
otpSchema.statics.createOTP = async function(email, purpose) {
    // Invalidate any existing OTPs for this email and purpose
    await this.updateMany(
        { email, purpose, isUsed: false },
        { isUsed: true }
    );

    // Generate new OTP
    const otp = this.generateOTP();
    
    // Create new OTP document
    const otpDoc = await this.create({
        email,
        otp,
        purpose
    });

    return otpDoc;
};

// Static method to verify OTP
otpSchema.statics.verifyOTP = async function(email, otp, purpose) {
    console.log('🔍 OTP Verification Debug:', {
        email,
        otp,
        purpose,
        currentTime: new Date(),
        searchQuery: {
            email,
            otp,
            purpose,
            isUsed: false,
            expiresAt: { $gt: new Date() }
        }
    });

    const otpDoc = await this.findOne({
        email,
        otp,
        purpose,
        isUsed: false,
        expiresAt: { $gt: new Date() }
    });

    console.log('📋 OTP Document Found:', {
        found: !!otpDoc,
        otpDoc: otpDoc ? {
            id: otpDoc._id,
            email: otpDoc.email,
            otp: otpDoc.otp,
            purpose: otpDoc.purpose,
            isUsed: otpDoc.isUsed,
            expiresAt: otpDoc.expiresAt,
            attempts: otpDoc.attempts,
            maxAttempts: otpDoc.maxAttempts
        } : null
    });

    if (!otpDoc) {
        return { valid: false, message: 'Invalid or expired OTP' };
    }

    // Check attempts
    if (otpDoc.attempts >= otpDoc.maxAttempts) {
        await otpDoc.updateOne({ isUsed: true });
        return { valid: false, message: 'Maximum attempts reached. Please request a new OTP.' };
    }

    // Increment attempts
    await otpDoc.updateOne({ $inc: { attempts: 1 } });

    return { valid: true, otpDoc };
};

const OTP = mongoose.model('OTP', otpSchema);

export default OTP;
