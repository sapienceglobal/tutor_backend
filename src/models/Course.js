import mongoose from 'mongoose';

const moduleSchema = new mongoose.Schema({
   _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  title: {
    type: String,
    required: true,
  },
  description: String,
  order: {
    type: Number,
    default: 0,
  },
});

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
  },
  thumbnail: {
    type: String,
    default: 'https://via.placeholder.com/400x250',
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    required: true,
  },
  price: {
    type: Number,
    default: 0,
    min: 0,
  },
  isFree: {
    type: Boolean,
    default: function() {
      return this.price === 0;
    },
  },
  level: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner',
  },
  duration: {
    type: Number, // in hours
    default: 0,
  },
  language: {
    type: String,
    default: 'English',
  },
  modules: [moduleSchema],
  enrolledCount: {
    type: Number,
    default: 0,
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  reviewCount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  },
  requirements: [String],
  whatYouWillLearn: [String],
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
courseSchema.pre('save', function () {
  this.updatedAt = Date.now();
});


export default mongoose.model('Course', courseSchema);