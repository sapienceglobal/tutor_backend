import mongoose from 'mongoose';

// Quiz Question Schema
const quizQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: [{
    text: String,
    isCorrect: Boolean,
  }],
  explanation: String,
  points: {
    type: Number,
    default: 1,
  },
});

// Document Schema
const documentSchema = new mongoose.Schema({
  name: String,
  url: String,
  type: String, // pdf, docx, pptx, etc.
  size: Number, // in bytes
});

const lessonSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Lesson title is required'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ['video', 'document', 'quiz', 'live'],
    default: 'video',
  },
  content: {
    // Video Content
    videoUrl: String,
    duration: Number, // in seconds
    
    // Document Content
    documents: [documentSchema],
    
    // Quiz Content
    quiz: {
      title: String,
      description: String,
      passingScore: {
        type: Number,
        default: 70, // percentage
      },
      timeLimit: Number, // in minutes (null = no limit)
      questions: [quizQuestionSchema],
      totalPoints: Number,
      shuffleQuestions: {
        type: Boolean,
        default: false,
      },
      shuffleOptions: {
        type: Boolean,
        default: false,
      },
      showCorrectAnswers: {
        type: Boolean,
        default: true,
      },
      allowRetake: {
        type: Boolean,
        default: true,
      },
      maxAttempts: {
        type: Number,
        default: null, // null = unlimited
      },
    },
    
    // Common attachments (PDFs, resources)
    attachments: [{
      name: String,
      url: String,
      type: String,
    }],
  },
  order: {
    type: Number,
    default: 0,
  },
  isFree: {
    type: Boolean,
    default: false,
  },
  isPublished: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
lessonSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate total points for quiz
  if (this.type === 'quiz' && this.content.quiz && this.content.quiz.questions) {
    this.content.quiz.totalPoints = this.content.quiz.questions.reduce(
      (sum, q) => sum + (q.points || 1), 
      0
    );
  }
  
  next();
});

export default mongoose.model('Lesson', lessonSchema);