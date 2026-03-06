import axios from 'axios';
import LessonEmbedding from '../models/LessonEmbedding.js';
import Lesson from '../models/Lesson.js';
import OpenAI from 'openai';
import mongoose from 'mongoose';

class VectorService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.chunkSize = 1000; // Chunk size for text splitting
    this.chunkOverlap = 200;
  }

  // Split text into chunks
  splitTextIntoChunks(text) {
    const chunks = [];
    const words = text.split(' ');

    for (let i = 0; i < words.length; i += this.chunkSize - this.chunkOverlap) {
      const chunk = words.slice(i, i + this.chunkSize).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }

    return chunks;
  }

  // Generate embeddings for text
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Embedding generation error:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  // Process and store lesson content embeddings
  async processLessonContent(lessonId) {
    try {
      const lesson = await Lesson.findById(lessonId).populate('courseId');
      if (!lesson) {
        throw new Error('Lesson not found');
      }

      const embeddings = [];

      // Process lesson title and description
      const lessonText = `${lesson.title}\n\n${lesson.description || ''}`;
      if (lessonText.trim()) {
        const chunks = this.splitTextIntoChunks(lessonText);

        for (let i = 0; i < chunks.length; i++) {
          const embedding = await this.generateEmbedding(chunks[i]);

          embeddings.push({
            lessonId: lesson._id,
            courseId: lesson.courseId._id,
            instituteId: lesson.courseId.instituteId,
            content: chunks[i],
            contentType: 'lesson_text',
            chunkIndex: i,
            embedding: embedding,
            metadata: {
              title: lesson.title,
              description: lesson.description
            }
          });
        }
      }

      // Process quiz questions if any
      if (lesson.type === 'quiz' && lesson.content.quiz && lesson.content.quiz.questions) {
        for (let i = 0; i < lesson.content.quiz.questions.length; i++) {
          const question = lesson.content.quiz.questions[i];
          const questionText = `${question.question}\n${question.explanation || ''}`;

          if (questionText.trim()) {
            const embedding = await this.generateEmbedding(questionText);

            embeddings.push({
              lessonId: lesson._id,
              courseId: lesson.courseId._id,
              instituteId: lesson.courseId.instituteId,
              content: questionText,
              contentType: 'quiz_question',
              chunkIndex: i,
              embedding: embedding,
              metadata: {
                title: lesson.title,
                description: `Quiz Question: ${question.question.substring(0, 100)}...`
              }
            });
          }
        }
      }

      // Clear existing embeddings for this lesson
      await LessonEmbedding.deleteMany({ lessonId: lesson._id });

      // Store new embeddings
      if (embeddings.length > 0) {
        await LessonEmbedding.insertMany(embeddings);
        console.log(`Generated and stored ${embeddings.length} embeddings for lesson ${lesson.title}`);
      }

      return {
        success: true,
        embeddingsCount: embeddings.length,
        lessonTitle: lesson.title
      };

    } catch (error) {
      console.error('Error processing lesson content:', error);
      throw error;
    }
  }

  // Perform similarity search
  async similaritySearch(query, courseId, instituteId, limit = 5) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      // Fetch all embeddings for this course
      const filter = { courseId: new mongoose.Types.ObjectId(courseId) };
      if (instituteId) {
        filter.instituteId = new mongoose.Types.ObjectId(instituteId);
      }

      const allDocs = await LessonEmbedding.find(filter).populate('lessonId', 'title description type').lean();

      // Calculate similarity in Node.js (Dot product works because OpenAI embeddings are normalized)
      const resultsWithSimilarity = [];

      for (const doc of allDocs) {
        let dotProduct = 0;
        for (let i = 0; i < queryEmbedding.length; i++) {
          dotProduct += queryEmbedding[i] * doc.embedding[i];
        }

        if (dotProduct >= 0.7) { // Similarity threshold
          resultsWithSimilarity.push({
            content: doc.content,
            contentType: doc.contentType,
            metadata: doc.metadata,
            similarity: dotProduct,
            lesson: doc.lessonId // Populated document
          });
        }
      }

      // Sort descending by similarity
      resultsWithSimilarity.sort((a, b) => b.similarity - a.similarity);

      // Return top matching results
      return resultsWithSimilarity.slice(0, limit);

    } catch (error) {
      console.error('Similarity search error:', error);
      throw error;
    }
  }

  // Delete embeddings for a lesson
  async deleteLessonEmbeddings(lessonId) {
    try {
      await LessonEmbedding.deleteMany({ lessonId });
      console.log(`Deleted embeddings for lesson ${lessonId}`);
    } catch (error) {
      console.error('Error deleting lesson embeddings:', error);
      throw error;
    }
  }

  // Get embeddings statistics
  async getEmbeddingStats(instituteId) {
    try {
      const stats = await LessonEmbedding.aggregate([
        {
          $match: {
            instituteId: new mongoose.Types.ObjectId(instituteId)
          }
        },
        {
          $group: {
            _id: '$contentType',
            count: { $sum: 1 }
          }
        }
      ]);

      const totalEmbeddings = await LessonEmbedding.countDocuments({
        instituteId: new mongoose.Types.ObjectId(instituteId)
      });

      return {
        total: totalEmbeddings,
        byType: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Error getting embedding stats:', error);
      throw error;
    }
  }
}

export default new VectorService();
