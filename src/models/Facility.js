import mongoose from 'mongoose';

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
    address: {
        street: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        zipCode: { type: String, default: '' },
        country: { type: String, default: '' },
    },
    features: [{
        name: { type: String, required: true },
        description: { type: String, default: '' },
        icon: { type: String, default: '' }, // icon name or URL
        isAvailable: { type: Boolean, default: true },
    }],
    infrastructure: [{
        name: { type: String, required: true }, // e.g., "Computer Lab", "Library"
        capacity: { type: Number, default: 0 },
        description: { type: String, default: '' },
        images: [String],
    }],
    images: [String], // campus photo URLs
    contactNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    mapUrl: { type: String, default: '' }, // Google Maps embed URL
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

facilitySchema.index({ instituteId: 1 });

export default mongoose.model('Facility', facilitySchema);
