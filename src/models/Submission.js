import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        required: true,
        index: true
    },
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment',
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
    content: {
        type: String // Text-based submission (optional if they just attach files)
    },
    attachments: [{
        name: String,
        url: String,
        type: String
    }],
    status: {
        type: String,
        enum: ['submitted', 'graded', 'returned'],
        default: 'submitted'
    },
    grade: {
        type: Number
    },
    feedback: {
        type: String
    },
    rubricScores: [{
        criterionId: mongoose.Schema.Types.ObjectId,
        points: Number,
        comments: String
    }],
    submittedAt: {
        type: Date,
        default: Date.now
    },
    gradedAt: {
        type: Date
    },
    gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Ensure a student can only submit once per assignment (we can handle resubmissions by updating or allowing multiple based on policy; keeping 1:1 for simplicity)
submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

export default mongoose.models.Submission || mongoose.model('Submission', submissionSchema);
