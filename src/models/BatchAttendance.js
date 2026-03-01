import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
    batchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Batch',
        required: true,
    },
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tutor',
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    records: [{
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['present', 'absent', 'late'],
            required: true,
        },
        remarks: {
            type: String,
            trim: true,
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Ensure a tutor can only mark attendance once per batch per date (ignoring time)
attendanceSchema.index({ batchId: 1, date: 1 }, { unique: true });

attendanceSchema.pre('save', function (next) {
    // Normalize date to start of day for easier querying
    if (this.isModified('date')) {
        const d = new Date(this.date);
        d.setHours(0, 0, 0, 0);
        this.date = d;
    }
    this.updatedAt = Date.now();
    next();
});

export default mongoose.model('BatchAttendance', attendanceSchema);
