import mongoose from 'mongoose';

const tutorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category' // Made optional for auto-creation during registration
  },
  hourlyRate: {
    type: Number,
    default: 0,
    min: 0
  },
  experience: {
    type: Number,
    default: 0,
    min: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  studentsCount: {
    type: Number,
    default: 0
  },
  subjects: [{
    type: String,
    trim: true
  }],
  scheduleAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduleAppointment',
  },
  bio: {
    type: String,
    trim: true
  },
  title: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  blockedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Tutor', tutorSchema);