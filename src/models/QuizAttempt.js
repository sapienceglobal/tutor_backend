import mongoose from 'mongoose';

const quizAttemptSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  
  // Quiz Metadata
  quizTitle: String,
  totalQuestions: Number,
  totalPoints: Number,
  
  // Student Answers
  answers: [{
    questionId: String, // MongoDB _id of the question
    selectedOptionIndex: Number, // 0, 1, 2, 3
    isCorrect: Boolean,
    pointsEarned: Number,
    timeTaken: Number, // seconds spent on this question
  }],
  
  // Results
  score: Number, // percentage
  pointsEarned: Number,
  pointsPossible: Number,
  isPassed: Boolean,
  
  // Timing
  startedAt: Date,
  submittedAt: Date,
  timeSpent: Number, // total seconds
  
  // Attempt Number
  attemptNumber: {
    type: Number,
    default: 1,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for faster queries
quizAttemptSchema.index({ studentId: 1, lessonId: 1, createdAt: -1 });

export default mongoose.model('QuizAttempt', quizAttemptSchema);