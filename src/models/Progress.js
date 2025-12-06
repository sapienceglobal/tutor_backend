import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema({
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
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0,
  },
  lastWatchedPosition: {
    type: Number, // in seconds
    default: 0,
  },
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index
progressSchema.index({ studentId: 1, courseId: 1, lessonId: 1 }, { unique: true });

export default mongoose.model('Progress', progressSchema);