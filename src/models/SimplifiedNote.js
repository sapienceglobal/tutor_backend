import mongoose from 'mongoose';

const simplifiedNoteSchema = new mongoose.Schema(
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

        // ── Input ─────────────────────────────────────────────────────
        originalText: {
            type: String,
            required: true,
        },
        sourceType: {
            type: String,
            enum: ['text', 'docx', 'pdf'],
            default: 'text',
        },
        sourceFileName: {
            type: String,
            default: null,
        },
        sourceFileUrl: {
            type: String,    // Cloudinary URL if file was uploaded
            default: null,
        },

        // ── Output ────────────────────────────────────────────────────
        simplifiedText: {
            type: String,
            required: true,
        },
        gradeLevel: {
            type: String,   // e.g. "8th Grade", "College Level"
            default: null,
        },

        // ── Computed stats ────────────────────────────────────────────
        originalWordCount: { type: Number, default: 0 },
        simplifiedWordCount: { type: Number, default: 0 },
        wordsReduced: { type: Number, default: 0 },
        infoRetained: { type: Number, default: 0 },   // 0–100 percentage

        // ── Sharing ───────────────────────────────────────────────────
        sharedToCourses: [{
            courseId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
            lessonId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },
            sharedAt:  { type: Date, default: Date.now },
            cloudinaryUrl: String,   // uploaded simplified PDF url
            cloudinaryId:  String,
        }],

        // ── User label ────────────────────────────────────────────────
        title: {
            type: String,
            default: 'Untitled Note',
            trim: true,
        },
    },
    { timestamps: true }
);

simplifiedNoteSchema.index({ userId: 1, createdAt: -1 });
simplifiedNoteSchema.index({ userId: 1, courseId: 1 });

export default mongoose.model('SimplifiedNote', simplifiedNoteSchema);