import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './src/models/User.js';
import jwt from 'jsonwebtoken';

dotenv.config();

async function testAIFeatures() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // 1. Find a test student
        const student = await User.findOne({ role: 'student' });
        if (!student) {
            console.log('No student found in DB to test with.');
            process.exit(0);
        }

        // 2. Generate a valid token
        const token = jwt.sign({ id: student._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        console.log(`Testing with student: ${student.name}`);

        // 3. Test Analytics Endpoint
        console.log('\n--- Testing AI Analytics ---');
        console.log('Calling Groq LLM (this usually takes 5-10 seconds)...');

        const analyticsRes = await axios.get('http://127.0.0.1:4000/api/ai/analytics/student', {
            headers: {
                Authorization: `Bearer ${token}`,
                'x-api-key': process.env.API_KEY
            }
        });

        console.log('\nAnalytics Result:');
        console.log(JSON.stringify(analyticsRes.data, null, 2));

        console.log('\n✅ AI Analytics Test Passed!');
        process.exit(0);

    } catch (error) {
        console.error('Test failed:');
        if (error.response) {
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

testAIFeatures();
