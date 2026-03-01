import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Institute',
        required: true,
        index: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    moduleId: {
        type: mongoose.Schema.Types.ObjectId
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String
    },
    dueDate: {
        type: Date
    },
    totalMarks: {
        type: Number,
        default: 100
    },
    rubric: [{
        criterion: { type: String, required: true },
        description: String,
        points: { type: Number, required: true }
    }],
    attachments: [{
        name: String,
        url: String,
        type: String
    }],
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'published'
    }
}, { timestamps: true });

export default mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);
