import mongoose from 'mongoose';
import {
  AUDIENCE_SCOPES,
  normalizeAudienceInput,
  syncLegacyAudience,
  validateAudience,
} from '../utils/audience.js';

const examQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  questionType: {
    type: String,
    enum: ['mcq', 'numeric', 'match_the_following', 'passage_based'],
    default: 'mcq',
  },
  options: [{
    text: {
      type: String,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
  }],
  // For numeric questions
  numericAnswer: {
    type: Number,
    default: null,
  },
  tolerance: {
    type: Number,
    default: 0, // allowable error margin
  },
  // For match-the-following
  pairs: [{
    left: String,
    right: String,
  }],
  // For passage-based
  passage: {
    type: String,
    default: null,
  },
  explanation: String,
  points: {
    type: Number,
    default: 1,
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium',
  },
  tags: [String],
}, { _id: true });

const examSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    required: true,
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    default: null,
  },
  instituteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institute',
    default: null,
  },
  audience: {
    scope: {
      type: String,
      enum: Object.values(AUDIENCE_SCOPES),
      default: function () {
        if (this.batchId) return AUDIENCE_SCOPES.BATCH;
        return this.instituteId ? AUDIENCE_SCOPES.INSTITUTE : AUDIENCE_SCOPES.GLOBAL;
      },
      index: true,
    },
    instituteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Institute',
      default: null,
    },
    batchIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
    }],
    studentIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },
  title: {
    type: String,
    required: [true, 'Exam title is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ['midterm', 'final', 'quiz', 'practice', 'assessment'],
    default: 'assessment',
  },
  instructions: String,

  // Exam Settings
  duration: {
    type: Number, // in minutes
    required: true,
  },
  totalMarks: {
    type: Number,
    default: 0, // Will be calculated in pre-save hook
  },
  passingMarks: {
    type: Number,
    required: true,
  },
  passingPercentage: {
    type: Number,
    default: 0, // 0 means use passingMarks absolute value
  },

  // Exam Behavior
  negativeMarking: {
    type: Boolean,
    default: false,
  },

  // Questions
  questions: [examQuestionSchema],
  totalQuestions: {
    type: Number,
    default: 0,
  },

  // Exam Behavior
  shuffleQuestions: {
    type: Boolean,
    default: false,
  },
  shuffleOptions: {
    type: Boolean,
    default: false,
  },
  showResultImmediately: {
    type: Boolean,
    default: false,
  },
  showCorrectAnswers: {
    type: Boolean,
    default: true,
  },
  allowRetake: {
    type: Boolean,
    default: false,
  },
  hideSolutions: {
    type: Boolean,
    default: false,
  },
  isFree: {
    type: Boolean,
    default: false,
  },
  maxAttempts: {
    type: Number,
    default: 1,
  },

  // Sections (optional, for section-based timing)
  sections: [{
    name: { type: String, required: true },
    duration: { type: Number, required: true }, // minutes for this section
    questionStartIndex: { type: Number, required: true },
    questionEndIndex: { type: Number, required: true },
  }],

  // Adaptive Testing
  isAdaptive: {
    type: Boolean,
    default: false,
  },

  // Scheduling
  startDate: Date,
  endDate: Date,
  isScheduled: {
    type: Boolean,
    default: false,
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published',
  },
  isPublished: {
    type: Boolean,
    default: false,
  },

  // Statistics
  attemptCount: {
    type: Number,
    default: 0,
  },
  averageScore: {
    type: Number,
    default: 0,
  },

  // AI Generated
  isAIGenerated: {
    type: Boolean,
    default: false,
  },
  aiPrompt: String,

  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp and calculated fields on save
examSchema.pre('save', function () {
  this.updatedAt = Date.now();
  const questionList = Array.isArray(this.questions) ? this.questions : [];
  this.totalQuestions = questionList.length;
  this.totalMarks = questionList.reduce((sum, q) => sum + (q.points || 1), 0);

  const hasPassingPercentage = this.passingPercentage !== undefined
    && this.passingPercentage !== null
    && Number.isFinite(Number(this.passingPercentage));
  const hasPassingMarks = this.passingMarks !== undefined
    && this.passingMarks !== null
    && Number.isFinite(Number(this.passingMarks));

  if (hasPassingPercentage) {
    const safePercentage = Math.min(Math.max(Number(this.passingPercentage), 0), 100);
    this.passingPercentage = safePercentage;
    if (this.totalMarks > 0) {
      this.passingMarks = Number(((safePercentage / 100) * this.totalMarks).toFixed(2));
    }
  } else if (hasPassingMarks) {
    const safeMarks = Math.max(0, Number(this.passingMarks));
    this.passingMarks = safeMarks;
    if (this.totalMarks > 0) {
      this.passingPercentage = Number(((safeMarks / this.totalMarks) * 100).toFixed(2));
    }
  }

  const normalizedAudience = normalizeAudienceInput({
    audience: this.audience,
    instituteId: this.instituteId,
    batchId: this.batchId,
    batchIds: this.batchId ? [this.batchId] : [],
  }, {
    defaultScope: this.batchId
      ? AUDIENCE_SCOPES.BATCH
      : (this.instituteId ? AUDIENCE_SCOPES.INSTITUTE : AUDIENCE_SCOPES.GLOBAL),
    defaultInstituteId: this.instituteId,
  });

  const validatedAudience = validateAudience(normalizedAudience, {
    requireInstituteId: false,
    allowEmptyPrivate: true,
  });

  syncLegacyAudience(this, validatedAudience);

});

// Exam Attempt Schema (for tracking student attempts)
// In Exam.js model
const examAttemptSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true,
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
  attemptNumber: {
    type: Number,
    required: true,
  },
  answers: [{
    questionId: mongoose.Schema.Types.ObjectId,
    selectedOption: Number, // Index from shuffled array
    selectedOptionText: String, // Actual text of selected option (fixes shuffle bug)
    numericAnswer: Number, // ✅ NEW: For numeric questions
    matchAnswers: mongoose.Schema.Types.Mixed, // ✅ NEW: For match-the-following questions { "left1": "right2" }
    textAnswer: String,
    aiFeedback: String,
    isCorrect: Boolean,
    pointsEarned: Number,

    // ✅ NEW: Embed question data for review
    questionData: {
      question: String,
      options: [{ text: String }],
      correctOption: Number, // Index of correct answer
      explanation: String,
      points: Number,
      difficulty: String,
      questionType: String,
      numericAnswer: Number,
      tolerance: Number,
      pairs: [{ left: String, right: String }]
    },
  }],
  score: {
    type: Number,
    required: true,
  },
  percentage: {
    type: Number,
    required: true,
  },
  isPassed: {
    type: Boolean,
    required: true,
  },
  timeSpent: Number,
  percentile: {
    type: Number,
    default: null,
  },
  startedAt: {
    type: Date,
    required: true,
  },
  submittedAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // --- Test Integrity: Tab-switch logging ---
  tabSwitchLog: [{
    switchedAt: { type: Date, default: Date.now },
    count: { type: Number, default: 1 },
  }],
  tabSwitchCount: {
    type: Number,
    default: 0,
  },
});

// Index for faster queries
examAttemptSchema.index({ examId: 1, studentId: 1 });
examAttemptSchema.index({ courseId: 1, studentId: 1 });

export const Exam = mongoose.model('Exam', examSchema);
export const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema);

