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
    moderationStatus: {
        type: String,
        enum: ['visible', 'flagged', 'resolved', 'hidden'],
        default: 'visible',
        index: true
    },
    isHidden: {
        type: Boolean,
        default: false,
        index: true
    },
    hiddenReason: {
        type: String,
        trim: true,
        maxlength: 300,
        default: ''
    },
    hiddenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    hiddenAt: {
        type: Date,
        default: null
    },
    tutorReply: {
        text: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: ''
        },
        tutorUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        repliedAt: {
            type: Date,
            default: null
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for fast lookup by lesson
lessonCommentSchema.index({ lessonId: 1, createdAt: -1 });
lessonCommentSchema.index({ lessonId: 1, moderationStatus: 1, createdAt: -1 });

lessonCommentSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

const LessonComment = mongoose.model('LessonComment', lessonCommentSchema);

export default LessonComment;
