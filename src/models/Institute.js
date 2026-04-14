import mongoose from 'mongoose';

// ─── Reusable theme sub-schema ───────────────────────────────────────────────
const themeSchema = new mongoose.Schema({
    primaryColor:   { type: String, default: '#4338ca' },
    secondaryColor: { type: String, default: '#f8fafc' },
    accentColor:    { type: String, default: '#6366f1' },
    sidebarColor:   { type: String, default: '#1e1b4b' },
    fontFamily:     { type: String, default: "'DM Sans', sans-serif" },
    fontSize:       { type: String, default: '14' },
}, { _id: false });

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

    // ── Legacy flat brandColors (kept for backward compat) ─────────────────
    brandColors: {
        primary:   { type: String, default: '#4F46E5' },
        secondary: { type: String, default: '#F97316' },
        accent:    { type: String, default: '#6366f1' },
        sidebar:   { type: String, default: '#1e1b4b' },
    },

    // ── NEW: Role-specific themes ──────────────────────────────────────────
    // Institute admin sets these for their student/tutor panels
    studentTheme: {
        type: themeSchema,
        default: () => ({
            primaryColor:   '#4338ca',
            secondaryColor: '#f8fafc',
            accentColor:    '#6366f1',
            sidebarColor:   '#1e1b4b',
            fontFamily:     "'DM Sans', sans-serif",
            fontSize:       '14',
        }),
    },
    tutorTheme: {
        type: themeSchema,
        default: () => ({
            primaryColor:   '#f97316',
            secondaryColor: '#fff7ed',
            accentColor:    '#fb923c',
            sidebarColor:   '#0f172a',
            fontFamily:     "'DM Sans', sans-serif",
            fontSize:       '14',
        }),
    },

    // ── Theme Settings ─────────────────────────────────────────────────────
    themeSettings: {
        // When true → ignore studentTheme/tutorTheme and use SuperAdmin's global themes
        useGlobalTheme: { type: Boolean, default: false },
        fontFamily:     { type: String,  default: "'DM Sans', sans-serif" },
        fontSize:       { type: String,  default: '14' },
    },

    // ── Plan & Features ────────────────────────────────────────────────────
    subscriptionPlan: {
        type: String,
        // enum: ['free', 'basic', 'pro', 'enterprise'],
        default: 'free'
    },
    features: {
        hlsStreaming:       { type: Boolean, default: false },
        customBranding:     { type: Boolean, default: false },
        zoomIntegration:    { type: Boolean, default: false },
        aiFeatures:         { type: Boolean, default: false },
        manageTutors:       { type: Boolean, default: true  },
        manageStudents:     { type: Boolean, default: true  },
        maxTutors:          { type: Number,  default: 5     },
        maxStudents:        { type: Number,  default: 50    },
        customDomain:       { type: Boolean, default: false },
        advancedAnalytics:  { type: Boolean, default: false },
        apiAccess:          { type: Boolean, default: false },
        allowGlobalPublishingByInstituteTutors: { type: Boolean, default: false }
    },

    isActive:     { type: Boolean, default: true },
    contactEmail: { type: String,  trim: true },
    superadminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    subscriptionExpiresAt: { type: Date,   default: null },
    aiUsageQuota:          { type: Number, default: 1000 },
    aiUsageCount:          { type: Number, default: 0    },
    customDomain:          { type: String, trim: true, default: null },

}, { timestamps: true });

const Institute = mongoose.model('Institute', instituteSchema);
export { Institute };
export default Institute;