
import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
    liveClassId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LiveClass',
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['present', 'absent', 'late'],
        default: 'present'
    }
});

// Prevent duplicate attendance for same class & student
attendanceSchema.index({ liveClassId: 1, studentId: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
