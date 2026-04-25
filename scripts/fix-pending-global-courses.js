/**
 * One-time migration script:
 * Finds all pending courses whose tutor has NO instituteId (independent/global tutors)
 * and auto-publishes them — since there is no admin to approve them.
 * 
 * Run: node scripts/fix-pending-global-courses.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

await mongoose.connect(MONGODB_URI);
console.log('✅ Connected to MongoDB');

// Get all pending courses
const courses = await mongoose.connection.collection('courses').find({ status: 'pending' }).toArray();
console.log(`Found ${courses.length} pending course(s)`);

let fixed = 0;
for (const course of courses) {
    if (!course.tutorId) continue;

    // Check the tutor's instituteId
    const tutor = await mongoose.connection.collection('tutors').findOne({ _id: course.tutorId });
    if (!tutor) {
        console.log(`  ⚠️  Course "${course.title}" — tutor not found, skipping`);
        continue;
    }

    const isIndependent = !tutor.instituteId;
    if (isIndependent) {
        await mongoose.connection.collection('courses').updateOne(
            { _id: course._id },
            { $set: { status: 'published', visibility: 'public', visibilityScope: 'global' } }
        );
        console.log(`  ✅ Published: "${course.title}" (global/independent tutor)`);
        fixed++;
    } else {
        console.log(`  ⏭️  Skipped: "${course.title}" (institute tutor — needs admin approval)`);
    }
}

console.log(`\n🎉 Done. ${fixed} course(s) auto-published.`);
await mongoose.disconnect();
