import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Model Imports ────────────────────────────────────────────────────────────
import User from '../src/models/User.js';
import Course from '../src/models/Course.js';
import Batch from '../src/models/Batch.js';
import Enrollment from '../src/models/Enrollment.js';
import Progress from '../src/models/Progress.js';
import InstituteMembership from '../src/models/InstituteMembership.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function run() {
    try {
        console.log('🔄 Connecting to MongoDB at:', MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@'));
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        // 1. Find Riya
        const riya = await User.findOne({ email: 'riya.choudhury@gmail.com' });
        if (!riya) {
            throw new Error('Riya Choudhury not found.');
        }
        console.log(`👤 Found Student Riya: ${riya._id}`);

        // 2. Find Apex Institute ID (via Vikram's instituteId)
        const vikram = await User.findOne({ email: 'vikram@apexacademy.in' });
        if (!vikram || !vikram.instituteId) {
            throw new Error('Vikram or his institute ID not found.');
        }
        const apexInstituteId = vikram.instituteId;
        console.log(`🏛️ Found Apex Institute ID: ${apexInstituteId}`);

        // 3. Remove Apex Institute Membership for Riya
        const membershipResult = await InstituteMembership.deleteMany({
            userId: riya._id,
            instituteId: apexInstituteId
        });
        console.log(`🗑️ Deleted ${membershipResult.deletedCount} Apex membership records for Riya.`);

        // 4. Find Apex Courses (c5 & c8)
        const courses = await Course.find({
            title: { $in: ['NEET Biology Masterclass 2026', 'JEE Maths — Calculus & Algebra Mastery'] }
        });
        const courseIds = courses.map(c => c._id);
        console.log(`📚 Found Apex Courses: ${courses.map(c => c.title).join(', ')}`);

        // 5. Delete Enrollments for Riya in Apex Courses
        const enrollmentResult = await Enrollment.deleteMany({
            studentId: riya._id,
            courseId: { $in: courseIds }
        });
        console.log(`🗑️ Deleted ${enrollmentResult.deletedCount} enrollment records for Riya in Apex courses.`);

        // 6. Delete Progress for Riya in Apex Courses
        const progressResult = await Progress.deleteMany({
            studentId: riya._id,
            courseId: { $in: courseIds }
        });
        console.log(`🗑️ Deleted ${progressResult.deletedCount} progress records for Riya in Apex courses.`);

        // 7. Pull Riya from Apex Batches
        const batchResult = await Batch.updateMany(
            { instituteId: apexInstituteId },
            { $pull: { students: riya._id } }
        );
        console.log(`🔓 Pulled Riya from Apex batches (updated ${batchResult.modifiedCount} batches).`);

        console.log('\n🎉 Riya Choudhury consistency check completed!');
    } catch (err) {
        console.error('❌ Error in fixing Riya:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔄 Disconnected from MongoDB.');
    }
}

run();
