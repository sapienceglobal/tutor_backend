import mongoose from 'mongoose';

const instituteSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Institute name is required'],
        trim: true,
        unique: true
    },
    subdomain: {
        type: String,
        required: [true, 'Subdomain is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    logo: {
        type: String,
        default: 'https://via.placeholder.com/150?text=Logo'
    },
    brandColors: {
        primary: { type: String, default: '#4F46E5' }, // Default Indigo
        secondary: { type: String, default: '#F97316' } // Default Orange
    },
    subscriptionPlan: {
        type: String,
        enum: ['free', 'basic', 'pro', 'enterprise'],
        default: 'free'
    },
    features: {
        hlsStreaming: { type: Boolean, default: false },
        customBranding: { type: Boolean, default: false },
        zoomIntegration: { type: Boolean, default: false },
        aiFeatures: { type: Boolean, default: false }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    contactEmail: {
        type: String,
        trim: true
    },
    superadminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // --- Subscription Expiry ---
    subscriptionExpiresAt: {
        type: Date,
        default: null,
    },

    // --- AI Usage Quota ---
    aiUsageQuota: {
        type: Number,
        default: 1000, // default quota per billing cycle
    },
    aiUsageCount: {
        type: Number,
        default: 0,
    },

    // --- White-label Domain ---
    customDomain: {
        type: String,
        trim: true,
        default: null,
    },
}, {
    timestamps: true
});

const Institute = mongoose.model('Institute', instituteSchema);
export default Institute;
