import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Course from '../src/models/Course.js';
import Assignment from '../src/models/Assignment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB.');

        const chemCourse = await Course.findOne({ title: /Chemistry/i });
        if (!chemCourse) {
            console.log('❌ Chemistry course not found!');
            return;
        }

        const assignments = await Assignment.find({ courseId: chemCourse._id });
        console.log(`\n📚 Assignments for course "${chemCourse.title}":`);
        if (assignments.length > 0) {
            assignments.forEach((asn, idx) => {
                console.log(`\nAssignment #${idx + 1}:`);
                console.log(` - Title: "${asn.title}"`);
                console.log(` - Description: "${asn.description}"`);
                console.log(` - Due Date: ${asn.dueDate}`);
                console.log(` - Total Marks: ${asn.totalMarks}`);
                console.log(` - Rubric criteria count: ${asn.rubric ? asn.rubric.length : 0}`);
                console.log(` - Status: ${asn.status}`);
            });
        } else {
            console.log(' ⚠️ No assignments found for Chemistry course.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
