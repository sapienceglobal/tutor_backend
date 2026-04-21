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
        
        // Advanced LMS
        hlsStreaming: { type: Boolean, default: false },
        customBranding: { type: Boolean, default: false },
        zoomIntegration: { type: Boolean, default: false },
        apiAccess: { type: Boolean, default: false },

        // 🌟 NEW: Tiered AI Features
        aiAssistant: { type: Boolean, default: false },   // Chat, Summary, Notes
        aiAssessment: { type: Boolean, default: false },  // Subjective Check, Plagiarism, Evaluator, Proctoring
        aiIntelligence: { type: Boolean, default: false },// Risk Predictor, Dropout, Automation Builder
        
        // 🌟 NEW: The Firewall against Bankruptcy
        aiCreditsPerMonth: { type: Number, default: 0 },  // How many times AI can be called
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