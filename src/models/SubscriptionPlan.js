import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    price: {
        type: Number,
        required: true,
        default: 0
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'yearly', 'lifetime'],
        default: 'monthly'
    },
    features: {
        maxTutors: { type: Number, default: 5 }, 
        maxStudents: { type: Number, default: 50 }, 
        storageLimitGB: { type: Number, default: 5 }, 
        hlsStreaming: { type: Boolean, default: false },
        aiBasic: { type: Boolean, default: false },
        customBranding: { type: Boolean, default: false },
        zoomIntegration: { type: Boolean, default: false },
        apiAccess: { type: Boolean, default: false }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isPopular: {
        type: Boolean,
        default: false 
    }
}, { timestamps: true });

export default mongoose.models.SubscriptionPlan || mongoose.model('SubscriptionPlan', subscriptionPlanSchema);