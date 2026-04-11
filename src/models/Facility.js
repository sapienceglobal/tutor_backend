import mongoose from 'mongoose';

const DEFAULT_CATEGORIES = ['Engineering', 'Management', 'Arts & Science', 'Medical', 'Others'];

const facilitySchema = new mongoose.Schema({
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        required: true,
    },
    campusName: {
        type: String,
        required: [true, 'Campus name is required'],
        trim: true,
    },
    branchCode: {
        type: String,
        trim: true,
        default: '',
    },
    address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        zipCode: { type: String, default: '' },
        country: { type: String, default: 'India' },
    },
    // Contact Information
    contactPerson: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    alternatePhone: { type: String, default: '' },
    website: { type: String, default: '' },
    notes: { type: String, default: '' },

    // Categories (multi-select from default list + custom)
    categories: [{ type: String, trim: true }],

    // Legacy fields kept for backward compat
    features: [{
        name: { type: String, required: true },
        description: { type: String, default: '' },
        icon: { type: String, default: '' },
        isAvailable: { type: Boolean, default: true },
    }],
    infrastructure: [{
        name: { type: String, required: true },
        capacity: { type: Number, default: 0 },
        description: { type: String, default: '' },
        images: [String],
    }],
    images: [String],
    mapUrl: { type: String, default: '' },
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending'],
        default: 'active',
    },
}, { timestamps: true });

facilitySchema.index({ instituteId: 1 });

export { DEFAULT_CATEGORIES };
export default mongoose.model('Facility', facilitySchema);
