import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../src/models/User.js';
import Course from '../src/models/Course.js';
import Tutor from '../src/models/Tutor.js';
import Enrollment from '../src/models/Enrollment.js';
import { Exam, ExamAttempt } from '../src/models/Exam.js';
import Payment from '../src/models/Payment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function run() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        // 1. Verify Chemistry Course
        const chemCourse = await Course.findOne({ title: 'JEE Chemistry — Organic Mechanisms & Coordination Compounds' }).populate('tutorId');
        if (chemCourse) {
            console.log('📚 [OK] Chemistry Course found:', chemCourse.title);
            console.log('   Tutor profile reference ID:', chemCourse.tutorId?._id);
        } else {
            console.log('❌ Chemistry Course NOT found!');
        }

        // 2. Verify Enrollments
        const aarav = await User.findOne({ email: 'aarav.patel@gmail.com' });
        const diya = await User.findOne({ email: 'diya.sharma@gmail.com' });
        const ishaan = await User.findOne({ email: 'ishaan.gupta@gmail.com' });
        const riya = await User.findOne({ email: 'riya.choudhury@gmail.com' });

        if (aarav && chemCourse) {
            const aaravEnroll = await Enrollment.findOne({ studentId: aarav._id, courseId: chemCourse._id });
            console.log('🎓 [OK] Aarav Chemistry Enrollment:', aaravEnroll ? `Found (progress: ${aaravEnroll.progress.percentage}%)` : 'NOT found!');
        }

        // 3. Verify Chemistry Exams
        const exams = await Exam.find({ courseId: chemCourse?._id });
        console.log(`🧪 [OK] Found ${exams.length} Chemistry exams.`);
        for (const e of exams) {
            console.log(`   - ${e.title} (${e.type}, ${e.questions.length} questions)`);
        }

        // 4. Verify Exam Attempts
        const attempts = await ExamAttempt.find({ studentId: aarav?._id }).populate('examId', 'title');
        console.log(`📝 [OK] Aarav has ${attempts.length} total exam attempts in the database:`);
        for (const att of attempts) {
            console.log(`   - Exam: ${att.examId?.title || 'Unknown'}, Score: ${att.score}, Passed: ${att.isPassed}, Date: ${att.submittedAt}`);
        }

        // 5. Verify Payments
        const aaravPayments = await Payment.find({ studentId: aarav?._id }).populate('courseId', 'title');
        console.log(`💰 [OK] Aarav has ${aaravPayments.length} payment records:`);
        for (const p of aaravPayments) {
            console.log(`   - Title: ${p.title}, Amount: ₹${p.amount}, Status: ${p.status}, Type: ${p.type}`);
        }

        const riyaPayments = await Payment.find({ studentId: riya?._id }).populate('courseId', 'title');
        console.log(`💰 [OK] Riya has ${riyaPayments.length} payment records:`);
        for (const p of riyaPayments) {
            console.log(`   - Title: ${p.title}, Amount: ₹${p.amount}, Status: ${p.status}, Type: ${p.type}`);
        }

        const diyaPayments = await Payment.find({ studentId: diya?._id }).populate('courseId', 'title');
        console.log(`💰 [OK] Diya has ${diyaPayments.length} payment records:`);
        for (const p of diyaPayments) {
            console.log(`   - Title: ${p.title}, Amount: ₹${p.amount}, Status: ${p.status}, Type: ${p.type}`);
        }

    } catch (err) {
        console.error('❌ Error during verification:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔄 Disconnected.');
    }
}

run();
