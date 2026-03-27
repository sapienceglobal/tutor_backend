import mongoose from 'mongoose';

const aiCourseSchema = new mongoose.Schema({
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

    // Input config
    topic:       { type: String, required: true },
    subject:     { type: String, default: '' },
    gradeLevel:  { type: String, default: '' },
    difficulty:  { type: String, enum: ['easy', 'balanced', 'focused', 'advanced'], default: 'balanced' },

    // Selected sections
    sections: {
        visualLessons:       { type: Boolean, default: true  },
        practiceQuizzes:     { type: Boolean, default: true  },
        flashcards:          { type: Boolean, default: true  },
        assignments:         { type: Boolean, default: true  },
        conceptSummaries:    { type: Boolean, default: true  },
        formativeAssessments:{ type: Boolean, default: true  },
        includeAIChatbot:    { type: Boolean, default: false },
    },

    // AI Generated content
    title:             { type: String, required: true },
    description:       { type: String, default: '' },
    learningObjectives:[{ type: String }],
    estimatedDuration: { type: String, default: '' },
    targetAudience:    { type: String, default: '' },

    modules: [{
        moduleNumber: Number,
        title:        String,
        description:  String,
        duration:     String,
        lessons: [{
            lessonNumber: Number,
            title:        String,
            type:         { type: String, enum: ['video', 'reading', 'quiz', 'assignment', 'flashcard', 'summary'] },
            duration:     String,
            description:  String,
            keyPoints:    [String],
        }],
    }],

    flashcards: [{
        front: String,
        back:  String,
    }],

    sampleQuiz: [{
        question:      String,
        options:       [String],
        correctAnswer: String,
    }],

    status: { type: String, enum: ['generating', 'ready', 'failed'], default: 'ready' },
}, { timestamps: true });

aiCourseSchema.index({ tutorId: 1, createdAt: -1 });

export default mongoose.model('AICourse', aiCourseSchema);