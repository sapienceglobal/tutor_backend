import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
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
  title: {
    type: String,
    default: '',
  },
  content: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

// Non-unique index for fast lookups per student, course, and lesson
noteSchema.index({ studentId: 1, courseId: 1, lessonId: 1 });

// Automatically drop the old unique index if it exists on database connection open
mongoose.connection.on('open', async () => {
  try {
    const NoteCollection = mongoose.connection.collection('notes');
    await NoteCollection.dropIndex('studentId_1_courseId_1_lessonId_1');
    console.log('Successfully dropped unique index on notes collection');
  } catch (err) {
    // Ignore error if index doesn't exist
  }
});

export default mongoose.model('Note', noteSchema);
