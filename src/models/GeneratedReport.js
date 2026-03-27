import mongoose from 'mongoose';

const generatedReportSchema = new mongoose.Schema({
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'Tutor',
        required: true,
        index: true,
    },
    instituteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:  'Institute',
        default: null,
    },

    // Report meta
    reportType:  { type: String, enum: ['student', 'course'], default: 'student' },
    title:       { type: String, required: true },
    description: { type: String, default: '' },

    // Target — student report
    studentIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    studentNames:[{ type: String }],

    // Target — course report
    courseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    courseName:  { type: String, default: '' },

    // Options
    highlightStrengths: { type: Boolean, default: true },
    quickSelection:     { type: String, default: '' },

    // AI Generated content
    summary:     { type: String, default: '' },
    students: [{
        studentId:   mongoose.Schema.Types.ObjectId,
        name:        String,
        avatar:      String,
        avgScore:    Number,
        progress:    Number,
        grade:       String,
        strengths:   [String],
        weaknesses:  [String],
        skillBreakdown: [{
            topic: String,
            score: Number,
            color: String,
        }],
        recommendation: String,
    }],

    status: { type: String, enum: ['generating', 'ready', 'failed'], default: 'ready' },
}, { timestamps: true });

generatedReportSchema.index({ tutorId: 1, createdAt: -1 });

export default mongoose.model('GeneratedReport', generatedReportSchema);