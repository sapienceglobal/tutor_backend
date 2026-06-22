import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import axios from 'axios';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';
const API_KEY = process.env.API_KEY || '';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const User = (await import('./src/models/User.js')).default;

    // Get Tutor Vikram
    const tutorUser = await User.findOne({ email: 'vikram@apexacademy.in' });
    if (!tutorUser) {
      console.log('Tutor Vikram not found');
      return;
    }
    console.log(`Found Tutor: ${tutorUser.name} (${tutorUser.email})`);

    // Generate token
    const token = jwt.sign(
      { id: tutorUser._id, role: tutorUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Add session to database so protect middleware doesn't reject it
    const sessionObj = {
      token,
      device: 'NodeTest',
      ip: '127.0.0.1',
      lastActive: new Date()
    };
    await User.updateOne(
      { _id: tutorUser._id },
      { $push: { activeSessions: sessionObj } }
    );
    console.log('Successfully injected active session token into database.');

    try {
      console.log('Calling API POST /api/ai/draft-notification...');
      const res = await axios.post(
        'http://127.0.0.1:4000/api/ai/draft-notification',
        {
          targetType: 'student',
          targetId: 'mock-id',
          contextTopic: 'Please check your JEE physics notes.',
          tone: 'Encouraging'
        },
        {
          headers: {
            'x-api-key': API_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('API Response Status:', res.status);
      console.log('API Response Data:', res.data);

    } catch (error) {
      if (error.response) {
        console.error('API Error Status:', error.response.status);
        console.error('API Error Data:', error.response.data);
      } else {
        console.error('Request Error:', error.message);
      }
    } finally {
      // Clean up session token
      await User.updateOne(
        { _id: tutorUser._id },
        { $pull: { activeSessions: { token } } }
      );
      console.log('Cleaned up session token.');
    }

  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
