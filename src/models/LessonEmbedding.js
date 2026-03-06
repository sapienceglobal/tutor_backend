import mongoose from 'mongoose';

const lessonEmbeddingSchema = new mongoose.Schema({
  lessonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson',
    required: true,
    index: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true
  },
  instituteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institute',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  contentType: {
    type: String,
    enum: ['lesson_text', 'document_content', 'video_transcript', 'quiz_question'],
    required: true
  },
  chunkIndex: {
    type: Number,
    required: true
  },
  embedding: {
    type: [Number],
    required: true
  },
  metadata: {
    title: String,
    description: String,
    documentName: String,
    documentType: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Create vector search index for MongoDB Atlas
lessonEmbeddingSchema.index({ 
  embedding: 'vector' 
}, {
  name: 'vector_index',
  dimensions: 1536, // OpenAI embedding dimensions
  similarity: 'cosine'
});

// Compound index for efficient filtering
lessonEmbeddingSchema.index({ 
  courseId: 1, 
  instituteId: 1, 
  contentType: 1 
});

export default mongoose.model('LessonEmbedding', lessonEmbeddingSchema);
