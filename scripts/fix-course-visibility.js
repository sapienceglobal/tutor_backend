import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

await mongoose.connect(MONGODB_URI);
console.log('✅ Connected to MongoDB');

const courses = await mongoose.connection.collection('courses').find({ visibility: 'institute', instituteId: null }).toArray();
console.log(`Found ${courses.length} courses with institute visibility but no instituteId.`);

let fixed = 0;
for (const course of courses) {
    if (!course.tutorId) continue;
    const tutor = await mongoose.connection.collection('tutors').findOne({ _id: course.tutorId });
    if (!tutor || tutor.instituteId) continue; // Skip if tutor belongs to an institute
    
    await mongoose.connection.collection('courses').updateOne(
        { _id: course._id },
        { 
            $set: { 
                visibility: 'public', 
                visibilityScope: 'global',
                'audience.scope': 'global',
                'audience.instituteId': null,
                status: 'published' // Ensure it's published
            } 
        }
    );
    fixed++;
    console.log(`  ✅ Fixed visibility for independent course: "${course.title}"`);
}

console.log(`\n🎉 Done. ${fixed} course(s) fixed.`);
await mongoose.disconnect();
