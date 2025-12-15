import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{
    text: { type: String, required: true },
    isCorrect: { type: Boolean, default: false },
  }],
  explanation: String,
  points: { type: Number, default: 1 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
}, { _id: true }); // Ensure subdocs have IDs

const questionSetSchema = new mongoose.Schema({
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
  title: { type: String, required: true, trim: true },
  description: String,
  tags: [String],
  questions: [questionSchema],
  
  // --- NEW FIELDS FOR BLUEPRINTING ---
  // Draft selection (kaunse questions selected the last time)
  selectedQuestionIds: [{ type: String }], 
  
  // Link to the live exam (agar publish ho chuka hai)
  publishedExamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    default: null
  },
  
  isArchived: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

questionSetSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

export const QuestionSet = mongoose.model('QuestionSet', questionSetSchema);