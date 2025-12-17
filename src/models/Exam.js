import mongoose from 'mongoose';

// Question Schema for Exam
const examQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: [{
    text: {
      type: String,
      required: true,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
  }],
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
}, { _id: true }); // Mongoose will auto-generate _id

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
    default: 70,
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
  maxAttempts: {
    type: Number,
    default: 1,
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
examSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  this.totalQuestions = this.questions.length;
  this.totalMarks = this.questions.reduce((sum, q) => sum + (q.points || 1), 0);

  if (this.passingMarks && this.totalMarks) {
    this.passingPercentage = Math.round((this.passingMarks / this.totalMarks) * 100);
  }


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
    selectedOption: Number,
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
});

// Index for faster queries
examAttemptSchema.index({ examId: 1, studentId: 1 });
examAttemptSchema.index({ courseId: 1, studentId: 1 });

export const Exam = mongoose.model('Exam', examSchema);
export const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema);