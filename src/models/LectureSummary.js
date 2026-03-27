import mongoose from 'mongoose';

const lectureSummarySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        instituteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Institute',
            default: null,
        },
        courseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            default: null,
        },
        lessonId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Lesson',
            default: null,
        },

        // ── Input ─────────────────────────────────────────────────────
        title: { type: String, required: true, trim: true },
        sourceType: {
            type: String,
            enum: ['lesson', 'file', 'text', 'youtube'],
            default: 'text',
        },
        sourceFileName: { type: String, default: null },
        sourceFileUrl:  { type: String, default: null },  // Cloudinary URL
        youtubeUrl:     { type: String, default: null },
        rawText:        { type: String, default: null },   // pasted text

        // ── Preferences ────────────────────────────────────────────────
        summaryLength: {
            type: String,
            enum: ['short', 'medium', 'detailed'],
            default: 'medium',
        },
        focusAreas: {
            type: [String],   // ['Key Concepts', 'Important Formulas', 'Examples', 'Key Takeaways']
            default: ['Key Concepts', 'Key Takeaways'],
        },

        // ── Output ────────────────────────────────────────────────────
        summary:       { type: String, default: null },
        keyPoints:     { type: [String], default: [] },
        keyTakeaways:  { type: [String], default: [] },
        studyNotes:    { type: String, default: null },

        // ── Computed stats ─────────────────────────────────────────────
        pageCount:      { type: Number, default: 0 },
        keyPointCount:  { type: Number, default: 0 },
        minutesSaved:   { type: Number, default: 0 },
        accuracy:       { type: Number, default: 98 },   // AI confidence %

        // ── Status ────────────────────────────────────────────────────
        status: {
            type: String,
            enum: ['processing', 'ready', 'failed'],
            default: 'processing',
        },
    },
    { timestamps: true }
);

lectureSummarySchema.index({ userId: 1, createdAt: -1 });
lectureSummarySchema.index({ userId: 1, courseId: 1 });
lectureSummarySchema.index({ lessonId: 1 });

export default mongoose.model('LectureSummary', lectureSummarySchema);