import mongoose from 'mongoose';

const lessonCommentSchema = new mongoose.Schema({
    lessonId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for fast lookup by lesson
lessonCommentSchema.index({ lessonId: 1, createdAt: -1 });

const LessonComment = mongoose.model('LessonComment', lessonCommentSchema);

export default LessonComment;
