import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import Course from '../src/models/Course.js';
import Lesson from '../src/models/Lesson.js';
import { Exam } from '../src/models/Exam.js';
import User from '../src/models/User.js';
import Enrollment from '../src/models/Enrollment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        const courses = await Course.find({}, 'title status');
        console.log('\n--- COURSES ---');
        courses.forEach(c => console.log(`- "${c.title}" (${c._id})`));

        const exams = await Exam.find({}, 'title courseId type status isPublished');
        console.log('\n--- EXAMS ---');
        exams.forEach(e => console.log(`- "${e.title}" (Course ID: ${e.courseId}, status: ${e.status}, isPublished: ${e.isPublished})`));

        const chemCourse = await Course.findOne({ title: /Chemistry/i });
        if (chemCourse) {
            console.log('\n--- CHEMISTRY COURSE MODULES ---');
            chemCourse.modules.forEach(m => {
                console.log(`Module: "${m.title}" (_id: ${m._id})`);
            });

            const lessons = await Lesson.find({ courseId: chemCourse._id });
            console.log('\n--- CHEMISTRY LESSONS ---');
            lessons.forEach(l => {
                console.log(`Lesson: "${l.title}" (courseId: ${l.courseId}, moduleId: ${l.moduleId})`);
            });
        }

        const aarav = await User.findOne({ email: 'aarav.patel@gmail.com' });
        if (aarav) {
            const enrollments = await Enrollment.find({ studentId: aarav._id }).populate('courseId', 'title');
            console.log('\n--- AARAV ENROLLMENTS ---');
            enrollments.forEach(en => console.log(`- "${en.courseId?.title}" (${en.status})`));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
