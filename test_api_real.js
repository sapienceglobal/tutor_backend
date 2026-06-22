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

    // Generate JWT token
    const token = jwt.sign(
      { id: tutorUser._id, role: tutorUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    console.log('Generated Token:', token);

    // Call the draft-notification API on port 4000
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
    await mongoose.disconnect();
  }
}
run();
