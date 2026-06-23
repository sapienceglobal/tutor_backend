import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from './models/User.js';
import TutorProfile from './models/TutorProfile.js';
import Tutor from './models/Tutor.js';
import Topic from './models/Topic.js';
import Skill from './models/Skill.js';
import Question from './models/Question.js';
import Course from './models/Course.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tutor-app';

const runSeed = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        // Find Vikram
        const user = await User.findOne({ name: /vikram/i });
        if (!user) {
            console.log('Vikram not found!');
            process.exit(1);
        }

        const tutorProfile = await TutorProfile.findOne({ userId: user._id });
        const tutor = await Tutor.findOne({ userId: user._id }) || tutorProfile;
        
        if (!tutor) {
            console.log('Tutor profile not found for Vikram');
            process.exit(1);
        }

        // Get a course if any
        const course = await Course.findOne({ tutorId: tutor._id });

        // We need to create 6 new Topics (Question Banks)
        const banksToCreate = [
            { name: 'Advanced Mathematics', count: 16 },
            { name: 'Physics Mechanics', count: 11 },
            { name: 'Organic Chemistry', count: 7 },
            { name: 'Data Structures', count: 26 },
            { name: 'History of Computing', count: 12 },
            { name: 'Machine Learning Basics', count: 20 },
            { name: 'Web Development Basics', count: 15 }
        ];

        // Ensure we have some skills
        let skills = await Skill.find({ tutorId: tutor._id });
        if (skills.length === 0) {
            const skill = await Skill.create({ tutorId: tutor._id, name: 'Problem Solving', description: 'General problem solving' });
            skills = [skill];
        }

        let totalQ = 0;

        for (const bank of banksToCreate) {
            let topic = await Topic.findOne({ name: bank.name });
            if (!topic) {
                topic = await Topic.create({
                    tutorId: tutor._id,
                    name: bank.name,
                    description: `Question bank for ${bank.name}`,
                    courseId: course ? course._id : null
                });
                console.log(`Created topic: ${topic.name}`);
            }

            for (let i = 0; i < bank.count; i++) {
                const isMCQ = Math.random() > 0.3; // 70% MCQ, 30% Subjective
                await Question.create({
                    tutorId: tutor._id,
                    type: isMCQ ? 'mcq' : 'subjective',
                    question: `Sample Question ${i + 1} for ${bank.name}?`,
                    options: isMCQ ? [
                        { text: 'Option A', isCorrect: true },
                        { text: 'Option B', isCorrect: false },
                        { text: 'Option C', isCorrect: false },
                        { text: 'Option D', isCorrect: false }
                    ] : [],
                    idealAnswer: isMCQ ? null : 'This is an ideal answer for the subjective question.',
                    explanation: 'Detailed explanation for this question.',
                    points: Math.floor(Math.random() * 5) + 1,
                    difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)],
                    topicId: topic._id,
                    skillId: skills[Math.floor(Math.random() * skills.length)]._id
                });
                totalQ++;
            }
            console.log(`Added ${bank.count} questions to ${bank.name}`);
        }

        console.log(`Successfully added ${banksToCreate.length} question banks and ${totalQ} questions for Vikram.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

runSeed();
