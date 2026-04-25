import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

await mongoose.connect(MONGODB_URI);
console.log('✅ Connected to MongoDB');

const courses = await mongoose.connection.collection('courses').find({ status: 'published' }).sort({ createdAt: -1 }).limit(5).toArray();

for (const course of courses) {
    const tutor = await mongoose.connection.collection('tutors').findOne({ _id: course.tutorId });
    console.log(`Course: ${course.title} | Visibility: ${course.visibility} | VisibilityScope: ${course.visibilityScope} | Status: ${course.status}`);
    console.log(`  Tutor Verified: ${tutor?.isVerified} | Institute: ${tutor?.instituteId}`);
}

await mongoose.disconnect();
