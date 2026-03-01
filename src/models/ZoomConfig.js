import mongoose from 'mongoose';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'sapience-lms-default-32char-key!'; // Must be 32 bytes
const IV_LENGTH = 16;

const zoomConfigSchema = new mongoose.Schema({
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        unique: true,
        sparse: true,
    },
    clientId: {
        type: String,
        default: '',
    },
    clientSecret: {
        type: String,
        default: '',
    },
    accountId: {
        type: String,
        default: '',
    },
    isEnabled: {
        type: Boolean,
        default: false,
    },
    usageLogs: [{
        date: { type: Date, default: Date.now },
        meetingCount: { type: Number, default: 0 },
        totalMinutes: { type: Number, default: 0 },
    }],
}, {
    timestamps: true,
});

// Encrypt clientSecret before save
zoomConfigSchema.pre('save', function (next) {
    if (this.isModified('clientSecret') && this.clientSecret && !this.clientSecret.startsWith('enc:')) {
        try {
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
            let encrypted = cipher.update(this.clientSecret, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            this.clientSecret = `enc:${iv.toString('hex')}:${encrypted}`;
        } catch (err) {
            console.error('Encryption error:', err);
        }
    }
    next();
});

// Decrypt method
zoomConfigSchema.methods.getDecryptedSecret = function () {
    if (!this.clientSecret || !this.clientSecret.startsWith('enc:')) {
        return this.clientSecret;
    }
    try {
        const parts = this.clientSecret.split(':');
        const iv = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error('Decryption error:', err);
        return '***decryption-failed***';
    }
};

export default mongoose.model('ZoomConfig', zoomConfigSchema);
