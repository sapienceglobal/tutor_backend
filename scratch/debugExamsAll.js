import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../src/models/User.js';
import Course from '../src/models/Course.js';
import Enrollment from '../src/models/Enrollment.js';
import { Exam } from '../src/models/Exam.js';
import { Institute } from '../src/models/Institute.js';
import { featureFlags } from '../src/config/featureFlags.js';
import { getForUser as getEntitlementsForUser } from '../src/services/entitlementService.js';
import { evaluateAccess } from '../src/services/accessPolicy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB.');

        const student = await User.findOne({ email: 'aarav.patel@gmail.com' });
        if (!student) {
            console.log('Student not found.');
            return;
        }

        console.log(`Student: ${student.name} (${student._id})`);
        console.log('Feature Flags:', featureFlags);

        // Get enrollments
        const enrollments = await Enrollment.find({ studentId: student._id });
        const enrolledCourseIds = enrollments.map(e => e.courseId.toString());
        console.log('\nEnrolled Course IDs:');
        enrollments.forEach(e => console.log(` - ${e.courseId} (status: ${e.status})`));

        // Get entitlements
        const entitlements = (featureFlags.audienceEnforceV2 || featureFlags.audienceReadV2Shadow)
            ? await getEntitlementsForUser(student)
            : null;
        console.log('\nEntitlements loaded:', !!entitlements);

        // Fetch published exams
        const exams = await Exam.find({ status: 'published' }).populate('courseId');
        console.log(`\nFound ${exams.length} published exams in DB.`);

        exams.forEach(exam => {
            console.log(`\n--- Exam: "${exam.title}" ---`);
            if (!exam.courseId) {
                console.log(' ❌ Skip: no courseId');
                return;
            }

            console.log(` - Course ID: ${exam.courseId._id} ("${exam.courseId.title}")`);

            const isEnrolled = enrolledCourseIds.includes(exam.courseId._id.toString());
            console.log(` - Enrolled? ${isEnrolled}`);

            if (enrolledCourseIds.length > 0 && !isEnrolled) {
                console.log(' ❌ Skip: not in enrolledCourseIds');
                return;
            }

            if (enrolledCourseIds.length === 0) {
                console.log(' ❌ Skip: enrolledCourseIds is empty');
                return;
            }

            if (entitlements) {
                const accessDecision = evaluateAccess({
                    resource: exam,
                    entitlements,
                    requireEnrollment: !exam.isFree,
                    requirePayment: !exam.isFree,
                    isFree: exam.isFree,
                    courseId: exam.courseId?._id,
                    legacyAllowed: true,
                    shadowContext: {
                        route: 'GET /api/student/exams/all',
                        resourceType: 'exam',
                    },
                });
                console.log(` - Access evaluation decision: allowed = ${accessDecision.allowed}, reason = ${accessDecision.reason}`);
                if (featureFlags.audienceEnforceV2 && !accessDecision.allowed) {
                    console.log(' ❌ Skip: audienceEnforceV2 blocked');
                    return;
                }
            } else {
                console.log(' - No entitlements checked (flags off)');
            }

            console.log(' ✅ Included in final output!');
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
