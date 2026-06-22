import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../src/models/User.js';
import Tutor from '../src/models/Tutor.js';
import Course from '../src/models/Course.js';
import Topic from '../src/models/Topic.js';
import Skill from '../src/models/Skill.js';
import Question from '../src/models/Question.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function run() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        // Find Vikram
        const vikramUser = await User.findOne({ email: 'vikram@apexacademy.in' });
        if (!vikramUser) {
            console.error('❌ Vikram not found');
            return;
        }
        const vikramTutor = await Tutor.findOne({ userId: vikramUser._id });
        if (!vikramTutor) {
            console.error('❌ Vikram Tutor profile not found');
            return;
        }

        console.log(`👤 Tutor: ${vikramUser.name} (Tutor ID: ${vikramTutor._id})`);

        // Query Topics
        const topics = await Topic.find({ tutorId: vikramTutor._id }).populate('courseId', 'title');
        console.log(`\n📂 Topics for Vikram (Count: ${topics.length}):`);
        topics.forEach(t => {
            console.log(`- ${t.name} (Course: ${t.courseId?.title || 'None'})`);
        });

        // Query Skills
        const skills = await Skill.find({ tutorId: vikramTutor._id });
        console.log(`\n🛠️ Skills for Vikram (Count: ${skills.length}):`);
        skills.forEach(s => {
            console.log(`- ${s.name}: ${s.description}`);
        });

        // Query Questions
        const questions = await Question.find({ tutorId: vikramTutor._id })
            .populate('topicId', 'name')
            .populate('skillId', 'name');
        console.log(`\n📝 Questions in Vikram's Question Bank (Count: ${questions.length}):`);
        questions.forEach(q => {
            console.log(`- Question: "${q.question.substring(0, 50)}..."`);
            console.log(`  Type: ${q.type}`);
            console.log(`  Topic: ${q.topicId?.name || 'None'}`);
            console.log(`  Skill: ${q.skillId?.name || 'None'}`);
            console.log(`  Difficulty: ${q.difficulty}`);
            console.log(`  Points: ${q.points}`);
            if (q.type === 'mcq') {
                console.log(`  Options:`, q.options.map(o => `${o.text}${o.isCorrect ? ' (Correct)' : ''}`));
            } else if (q.type === 'subjective') {
                console.log(`  Ideal Answer: "${q.idealAnswer.substring(0, 60)}..."`);
            }
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔄 Disconnected.');
    }
}

run();
