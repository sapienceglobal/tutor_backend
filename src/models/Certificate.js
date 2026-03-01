import mongoose from 'mongoose';

const certificateSchema = new mongoose.Schema({
    certificateId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // or Tutor depending on your schema setup, let's use User as it's the base
        required: true,
    },
    issuedAt: {
        type: Date,
        default: Date.now,
    },
    pdfUrl: {
        type: String,
        required: false, // In case we generate it on the fly or want to store the URL
    },
    qrCodeData: {
        type: String, // String representation of the verification URL
    }
});

// A student can only have one certificate per course
certificateSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

export default mongoose.model('Certificate', certificateSchema);
