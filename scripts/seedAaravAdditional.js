import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Model Imports ────────────────────────────────────────────────────────────
import User from '../src/models/User.js';
import Tutor from '../src/models/Tutor.js';
import Course from '../src/models/Course.js';
import Lesson from '../src/models/Lesson.js';
import Enrollment from '../src/models/Enrollment.js';
import Progress from '../src/models/Progress.js';
import Certificate from '../src/models/Certificate.js';
import LectureSummary from '../src/models/LectureSummary.js';
import SimplifiedNote from '../src/models/SimplifiedNote.js';
import GeneratedReport from '../src/models/GeneratedReport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

const ago = (days) => new Date(Date.now() - days * 86400000);

async function run() {
    try {
        console.log('🔄 Connecting to MongoDB at:', MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@'));
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        // 1. Find Student and Tutor Users
        const studentUser = await User.findOne({ email: 'aarav.patel@gmail.com' });
        if (!studentUser) {
            throw new Error('Student aarav.patel@gmail.com not found in database.');
        }
        console.log(`👤 Found Student: ${studentUser.name} (${studentUser._id})`);

        const tutorUser = await User.findOne({ email: 'vikram@apexacademy.in' });
        if (!tutorUser) {
            throw new Error('Tutor vikram@apexacademy.in not found in database.');
        }
        console.log(`👤 Found Tutor User: ${tutorUser.name} (${tutorUser._id})`);

        const tutorProfile = await Tutor.findOne({ userId: tutorUser._id });
        if (!tutorProfile) {
            throw new Error('Tutor profile not found for Vikram.');
        }
        console.log(`🎓 Found Tutor Profile ID: ${tutorProfile._id}`);

        // 2. Find Course and Lessons
        const course = await Course.findOne({ title: 'IIT JEE Physics Crash Course 2026' });
        if (!course) {
            throw new Error('JEE Physics course not found in database.');
        }
        console.log(`📚 Found Course: ${course.title} (${course._id})`);

        const lessons = await Lesson.find({ courseId: course._id }).sort({ order: 1 });
        if (lessons.length === 0) {
            throw new Error('No lessons found for the JEE Physics course.');
        }
        console.log(`📝 Found ${lessons.length} lessons for this course.`);

        // 3. Update Course Enrollment
        const lessonIds = lessons.map(l => l._id);
        const enrollment = await Enrollment.findOneAndUpdate(
            { studentId: studentUser._id, courseId: course._id },
            {
                $set: {
                    status: 'completed',
                    completedAt: ago(1),
                    'progress.completedLessons': lessonIds,
                    'progress.percentage': 100,
                    lastAccessed: new Date()
                }
            },
            { new: true, upsert: true }
        );
        console.log(`✅ Updated Enrollment status to 'completed' with 100% progress.`);

        // 4. Update Lesson Progress
        for (const lesson of lessons) {
            await Progress.findOneAndUpdate(
                { studentId: studentUser._id, courseId: course._id, lessonId: lesson._id },
                {
                    $set: {
                        completed: true,
                        completedAt: ago(5),
                        timeSpent: 1200,
                        lastWatchedPosition: 1200
                    }
                },
                { upsert: true }
            );
        }
        console.log(`✅ Marked all ${lessons.length} lessons as completed in Progress.`);

        // 5. Create Certificate
        const certificate = await Certificate.findOneAndUpdate(
            { studentId: studentUser._id, courseId: course._id },
            {
                $set: {
                    certificateId: 'CERT-SAP-2026-0002',
                    tutorId: tutorUser._id,
                    issuedAt: ago(1),
                    qrCodeData: 'https://sapience.io/verify/CERT-SAP-2026-0002'
                }
            },
            { upsert: true, new: true }
        );
        console.log(`🎓 Created/Updated Certificate: ${certificate.certificateId}`);

        // 6. Create Lecture Summary
        const lectureSummary = await LectureSummary.findOneAndUpdate(
            { userId: tutorUser._id, courseId: course._id, lessonId: lessons[0]._id },
            {
                $set: {
                    title: 'Lecture Summary: Newton\'s Laws & Constraints',
                    sourceType: 'lesson',
                    summary: 'This lecture covers Newton\'s three laws of motion in depth, with a focus on JEE Advanced application. Key topics include drawing Free Body Diagrams (FBDs) for coupled systems, resolving force vectors on inclined planes, and formulation of string constraint equations. We solved 5 distinct pulley-mass systems highlighting massless and mass-bearing pulleys.',
                    keyPoints: [
                        'Always define a coordinate system and draw a clean Free Body Diagram (FBD) for each body.',
                        'For string constraints, assume the string length is constant and differentiate twice to relate accelerations.',
                        'Action-reaction pairs must act on different bodies.'
                    ],
                    keyTakeaways: [
                        'Constraint relations are critical for multi-body pulley problems.',
                        'Moment of inertia must be considered if the pulley is not massless.'
                    ],
                    status: 'ready',
                    pageCount: 3,
                    keyPointCount: 3,
                    minutesSaved: 45,
                    accuracy: 98
                }
            },
            { upsert: true, new: true }
        );
        console.log(`💡 Created/Updated Lecture Summary: "${lectureSummary.title}"`);

        // 7. Create Shared Note from Tutor
        const sharedNote = await SimplifiedNote.findOneAndUpdate(
            { userId: tutorUser._id, title: 'Rotational Dynamics Cheat Sheet' },
            {
                $set: {
                    instituteId: course.instituteId,
                    courseId: course._id,
                    originalText: 'Rotational dynamics covers torque, angular momentum, and the conservation of angular momentum. Torque is the rotational equivalent of linear force, defined as the vector product of position vector and force vector. Angular momentum of a rigid body is the product of its moment of inertia and angular velocity.',
                    sourceType: 'text',
                    simplifiedText: '**Rotational Dynamics Made Simple!**\n\n• **Torque (τ):** Rotational force. τ = r × F (r = distance from pivot, F = force applied).\n• **Angular Momentum (L):** Rotational momentum. L = I × ω (I = Moment of Inertia, ω = Angular velocity).\n• **Conservation of L:** If net external torque is zero, angular momentum remains constant!',
                    gradeLevel: '11th Grade',
                    originalWordCount: 42,
                    simplifiedWordCount: 28,
                    wordsReduced: 14,
                    infoRetained: 98,
                    sharedToCourses: [{
                        courseId: course._id,
                        lessonId: lessons.length > 1 ? lessons[1]._id : null,
                        sharedAt: ago(1)
                    }]
                }
            },
            { upsert: true, new: true }
        );
        console.log(`📝 Created/Shared Simplified Note: "${sharedNote.title}"`);

        // 8. Create Generated Academic Report
        const generatedReport = await GeneratedReport.findOneAndUpdate(
            { tutorId: tutorProfile._id, courseId: course._id },
            {
                $set: {
                    instituteId: course.instituteId,
                    reportType: 'student',
                    title: 'JEE Physics Academic Performance Report',
                    description: 'Comprehensive evaluation of Aarav Patel for the IIT JEE Physics Course.',
                    studentIds: [studentUser._id],
                    studentNames: [studentUser.name],
                    courseName: course.title,
                    highlightStrengths: true,
                    summary: 'Aarav has demonstrated exceptional performance across the core concepts of mechanics. He shows a high aptitude for algebraic derivation and application of Faraday\'s laws. His primary area of concern is continuous body moment of inertia calculations.',
                    students: [{
                        studentId: studentUser._id,
                        name: studentUser.name,
                        avatar: studentUser.profileImage,
                        avgScore: 88,
                        progress: 100,
                        grade: 'A',
                        strengths: ['Linear Kinematics', 'FBD Vector Resolution', 'Electromagnetic Induction'],
                        weaknesses: ['Rotational Dynamics', 'Continuous Body Moment of Inertia'],
                        skillBreakdown: [
                            { topic: 'Linear Kinematics', score: 96, color: '#10B981' },
                            { topic: 'Newton\'s Laws', score: 90, color: '#6366F1' },
                            { topic: 'Electromagnetism', score: 88, color: '#8B5CF6' },
                            { topic: 'Rotational Mechanics', score: 68, color: '#EF4444' }
                        ],
                        recommendation: 'Solve 15-20 intermediate to advanced level numericals on rotational torque vectors and moment of inertia. Utilize the newly shared Rotational Dynamics Cheat Sheet.'
                    }],
                    status: 'ready'
                }
            },
            { upsert: true, new: true }
        );
        console.log(`📊 Created/Updated Academic Performance Report: "${generatedReport.title}"`);

        console.log('\n🎉 Additional seeding completed successfully!');
    } catch (err) {
        console.error('❌ Error in seeding:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔄 Disconnected from MongoDB.');
    }
}

run();
