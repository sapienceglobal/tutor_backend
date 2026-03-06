import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const setupVectorIndex = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Create vector search index for lessonembeddings collection
    await db.collection('lessonembeddings').createIndex({
      embedding: 'vector'
    }, {
      name: 'vector_index',
      dimensions: 1536, // OpenAI embedding dimensions
      similarity: 'cosine',
      background: true
    });

    console.log('✅ Vector index created successfully on lessonembeddings collection');

    // Create compound index for efficient filtering
    await db.collection('lessonembeddings').createIndex({
      courseId: 1,
      instituteId: 1,
      contentType: 1
    });

    console.log('✅ Compound index created successfully on lessonembeddings collection');

    console.log('\n🎉 Vector database setup completed!');
    console.log('You can now generate embeddings for your lessons using the API endpoints.');

  } catch (error) {
    console.error('❌ Error setting up vector index:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the setup
setupVectorIndex();
