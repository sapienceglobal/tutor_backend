import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Invalid email format',
        ],
    },
    phone: {
        type: String,
        default: '',
    },
    courseOfInterest: {
        type: mongoose.Schema.ObjectId,
        ref: 'Course',
        default: null,
    },
    message: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
        default: 'new',
    },
    assignedCounselor: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        default: null, // Ideally an admin or special counselor role
    },
    notes: [{
        text: String,
        addedBy: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    source: {
        type: String,
        default: 'website'
    },
    // Conversion Tracking
    conversionStatus: {
        type: String,
        enum: ['none', 'trial', 'enrolled', 'purchased'],
        default: 'none',
    },
    convertedAt: {
        type: Date,
        default: null,
    },
    conversionValue: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

export default mongoose.model('Lead', leadSchema);
