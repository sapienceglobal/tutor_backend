import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    required: true
  },
  dateTime: {
    type: Date,
    required: [true, 'Date and time is required']
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    default: 60
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
  },
  notes: {
    type: String,
    trim: true
  },
  meetingLink: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Appointment', appointmentSchema);