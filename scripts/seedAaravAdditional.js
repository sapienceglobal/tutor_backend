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
import Category from '../src/models/Category.js';
import { Exam, ExamAttempt } from '../src/models/Exam.js';
import Payment from '../src/models/Payment.js';
import Assignment from '../src/models/Assignment.js';
import Batch from '../src/models/Batch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

const ago = (days, hours = 0, mins = 0) => new Date(Date.now() - (days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000 + mins * 60 * 1000));
const future = (days, hours = 0, mins = 0) => new Date(Date.now() + (days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000 + mins * 60 * 1000));

async function run() {
    try {
        console.log('🔄 Connecting to MongoDB at:', MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@'));
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        console.log('🔄 Renaming courses and exams to remove JEE/NEET prefixes...');
        // Rename Courses
        await Course.updateOne(
            { title: 'IIT JEE Physics Crash Course 2026' },
            { $set: { title: 'Physics Crash Course 2026' } }
        );
        await Course.updateOne(
            { title: 'JEE Maths — Calculus & Algebra Mastery' },
            { $set: { title: 'Mathematics — Calculus & Algebra Mastery' } }
        );
        await Course.updateOne(
            { title: 'NEET Biology Masterclass 2026' },
            { $set: { title: 'Biology Masterclass 2026' } }
        );
        await Course.updateOne(
            { title: 'JEE Chemistry — Organic Mechanisms & Coordination Compounds' },
            { $set: { title: 'Chemistry — Organic Mechanisms & Coordination Compounds' } }
        );

        // Rename Exams
        await Exam.updateOne(
            { title: 'JEE Physics Mock Test — Mechanics' },
            { $set: { title: 'Physics Mock Test — Mechanics' } }
        );
        await Exam.updateOne(
            { title: 'JEE Physics Chapter Test — Electromagnetism' },
            { $set: { title: 'Physics Chapter Test — Electromagnetism' } }
        );
        await Exam.updateOne(
            { title: 'JEE Physics Practice Set — Thermodynamics' },
            { $set: { title: 'Physics Practice Set — Thermodynamics' } }
        );
        await Exam.updateOne(
            { title: 'JEE Maths — Limits & Derivatives Practice' },
            { $set: { title: 'Mathematics — Limits & Derivatives Practice' } }
        );
        await Exam.updateOne(
            { title: 'JEE Maths Mock Test — Integration & Area' },
            { $set: { title: 'Mathematics Mock Test — Integration & Area' } }
        );
        await Exam.updateOne(
            { title: 'JEE Maths Practice Set — Quadratic Equations' },
            { $set: { title: 'Mathematics Practice Set — Quadratic Equations' } }
        );
        await Exam.updateOne(
            { title: 'NEET Biology — Genetics Unit Test' },
            { $set: { title: 'Biology — Genetics Unit Test' } }
        );
        await Exam.updateOne(
            { title: 'JEE Chemistry Practice Set — Coordination Compounds' },
            { $set: { title: 'Chemistry Practice Set — Coordination Compounds' } }
        );
        await Exam.updateOne(
            { title: 'JEE Chemistry Chapter Test — Organic Mechanisms' },
            { $set: { title: 'Chemistry Chapter Test — Organic Mechanisms' } }
        );

        // Rename Payments
        await Payment.updateMany(
            { title: 'Enrollment: IIT JEE Physics Crash Course 2026' },
            { $set: { title: 'Enrollment: Physics Crash Course 2026' } }
        );
        await Payment.updateMany(
            { title: 'Enrollment: JEE Chemistry — Organic & Coordination' },
            { $set: { title: 'Enrollment: Chemistry — Organic & Coordination' } }
        );
        await Payment.updateMany(
            { title: 'Enrollment: NEET Biology Masterclass 2026' },
            { $set: { title: 'Enrollment: Biology Masterclass 2026' } }
        );
        console.log('✅ Renaming completed.');

        // Make some exams upcoming (10 days in the future)
        console.log('📅 Making some exams upcoming...');
        await Exam.updateOne(
            { title: 'Physics Chapter Test — Electromagnetism' },
            {
                $set: {
                    startDate: future(10),
                    endDate: future(20),
                    isScheduled: true
                }
            }
        );
        await Exam.updateOne(
            { title: 'Mathematics Mock Test — Integration & Area' },
            {
                $set: {
                    startDate: future(10),
                    endDate: future(20),
                    isScheduled: true
                }
            }
        );
        await Exam.updateOne(
            { title: 'Biology — Genetics Unit Test' },
            {
                $set: {
                    startDate: future(10),
                    endDate: future(20),
                    isScheduled: true
                }
            }
        );
        console.log('✅ Exam schedules updated to upcoming.');

        // Ensure Physics and Biology exams are accessible by relaxing batch restrictions
        console.log('🔓 Relaxing batch restrictions for Physics and Biology exams...');
        await Exam.updateMany(
            { title: { $in: ['Physics Mock Test — Mechanics', 'Physics Chapter Test — Electromagnetism', 'Physics Practice Set — Thermodynamics'] } },
            { $set: { 'audience.scope': 'institute', batchId: null } }
        );
        await Exam.updateMany(
            { title: 'Biology — Genetics Unit Test' },
            { $set: { 'audience.scope': 'institute', batchId: null } }
        );
        console.log('✅ Exam scopes updated to institute scope.');

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
        const course = await Course.findOne({ title: { $in: ['IIT JEE Physics Crash Course 2026', 'Physics Crash Course 2026'] } });
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

        // ══════════════════════════════════════════════════════════════════════
        //  9. ADDITIONAL CHEMISTRY COURSE & MIXED EXAMS SEEDING
        // ══════════════════════════════════════════════════════════════════════
        console.log('\n🧪 Seeding JEE Chemistry Course & Mixed Exams...');
        
        // Find Category
        const chemCategory = await Category.findOne({ name: 'Chemistry' });
        if (!chemCategory) {
            throw new Error('Chemistry category not found.');
        }

        // Find Sneha User & Tutor Profile
        const snehaUser = await User.findOne({ email: 'sneha@apexacademy.in' });
        if (!snehaUser) {
            throw new Error('Sneha user not found.');
        }
        const snehaTutorProfile = await Tutor.findOne({ userId: snehaUser._id });
        if (!snehaTutorProfile) {
            throw new Error('Sneha tutor profile not found.');
        }

        const apexInstituteId = course.instituteId; // derived from IIT JEE Physics course

        // Do not delete old JEE Chemistry course to prevent deleting student attempts/progress.
        // It has already been renamed above.

        // Create Chemistry Course
        const chemCourse = await Course.findOneAndUpdate(
            { title: 'Chemistry — Organic Mechanisms & Coordination Compounds' },
            {
                $set: {
                    description: 'Master Coordination Chemistry and Organic Reaction Mechanisms. Detailed analysis of SN1/SN2/E1/E2 pathways, isomerism in coordination compounds, and ligand field theory.',
                    thumbnail: 'https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?w=800&auto=format&fit=crop&q=60',
                    categoryId: chemCategory._id,
                    tutorId: snehaTutorProfile._id,
                    instituteId: apexInstituteId,
                    createdBy: snehaUser._id,
                    visibility: 'institute',
                    audience: { scope: 'institute', instituteId: apexInstituteId, batchIds: [], studentIds: [] },
                    price: 2499,
                    isFree: false,
                    level: 'intermediate',
                    duration: 30,
                    language: 'English',
                    status: 'published',
                    requirements: ['Class 11 Chemistry basic knowledge', 'Familiarity with functional groups'],
                    whatYouWillLearn: [
                        'Predict SN1 and SN2 reaction kinetics and products',
                        'Write structural and stereochemical IUPAC names of coordination complexes',
                        'Explain optical and geometrical isomerism in octahedral complexes',
                        'Master crystal field splitting parameter calculations'
                    ],
                    modules: [
                        { title: 'Coordination Chemistry', description: 'Ligands, IUPAC, VBT, CFT, Isomerism.', order: 1 },
                        { title: 'Reaction Mechanisms', description: 'SN1, SN2, nucleophiles, stereocenter outcomes.', order: 2 }
                    ],
                    enrolledCount: 3,
                    rating: 4.8,
                    reviewCount: 1
                }
            },
            { upsert: true, new: true }
        );
        console.log(`🧪 Created/Updated Chemistry Course: ${chemCourse.title} (${chemCourse._id})`);

        // Retrieve generated module IDs by querying Course back so Mongoose casts subdocument _id values correctly
        const courseWithModules = await Course.findById(chemCourse._id);
        if (!courseWithModules || !courseWithModules.modules || courseWithModules.modules.length < 2) {
            throw new Error('Chemistry course modules not found or failed to initialize.');
        }
        const module1Id = courseWithModules.modules[0]._id;
        const module2Id = courseWithModules.modules[1]._id;

        // Create Chemistry Lessons
        const lesson1 = await Lesson.findOneAndUpdate(
            { courseId: chemCourse._id, title: 'Coordination Compounds & Ligands Bonding' },
            {
                $set: {
                    moduleId: module1Id,
                    description: 'Introduction to coordination chemistry, naming conventions, and Werner theory of coordination complexes.',
                    duration: 1500, // 25 mins
                    videoUrl: 'https://res.cloudinary.com/demo/video/upload/v1615487663/dog.mp4',
                    order: 1,
                    isFree: true
                }
            },
            { upsert: true, new: true }
        );

        const lesson2 = await Lesson.findOneAndUpdate(
            { courseId: chemCourse._id, title: 'Sn1 and Sn2 Nucleophilic Substitution Mechanisms' },
            {
                $set: {
                    moduleId: module2Id,
                    description: 'Detailed mechanical comparison of unimolecular vs bimolecular nucleophilic substitution including stereochemistry.',
                    duration: 1800, // 30 mins
                    videoUrl: 'https://res.cloudinary.com/demo/video/upload/v1615487663/dog.mp4',
                    order: 2,
                    isFree: false
                }
            },
            { upsert: true, new: true }
        );
        console.log(`📝 Created/Updated Chemistry Lessons.`);

        // Enroll Students (Aarav, Diya, Ishaan)
        const diyaUser = await User.findOne({ email: 'diya.sharma@gmail.com' });
        const ishaanUser = await User.findOne({ email: 'ishaan.gupta@gmail.com' });

        const chemEnrollments = [
            { user: studentUser, pct: 50, completed: [lesson1._id] },
            { user: diyaUser, pct: 100, completed: [lesson1._id, lesson2._id] },
            { user: ishaanUser, pct: 0, completed: [] }
        ];

        for (const e of chemEnrollments) {
            if (e.user) {
                await Enrollment.findOneAndUpdate(
                    { studentId: e.user._id, courseId: chemCourse._id },
                    {
                        $set: {
                            status: e.pct === 100 ? 'completed' : 'active',
                            enrolledAt: ago(10),
                            completedAt: e.pct === 100 ? ago(2) : null,
                            'progress.completedLessons': e.completed,
                            'progress.percentage': e.pct,
                            lastAccessed: new Date()
                        }
                    },
                    { upsert: true }
                );

                // Update individual Lesson Progress
                for (const lid of e.completed) {
                    await Progress.findOneAndUpdate(
                        { studentId: e.user._id, courseId: chemCourse._id, lessonId: lid },
                        {
                            $set: {
                                completed: true,
                                completedAt: ago(5),
                                timeSpent: 900,
                                lastWatchedPosition: 900
                            }
                        },
                        { upsert: true }
                    );
                }
            }
        }
        console.log(`✅ Seeded/Updated Chemistry Course Enrollments.`);

        // Do not delete Chemistry exams to keep student attempts intact. They were renamed at startup.

        // Create Chemistry Exams
        const chemExam1 = await Exam.findOneAndUpdate(
            { courseId: chemCourse._id, title: 'Chemistry Practice Set — Coordination Compounds' },
            {
                $set: {
                    tutorId: snehaTutorProfile._id,
                    instituteId: apexInstituteId,
                    audience: { scope: 'institute', instituteId: apexInstituteId, batchIds: [], studentIds: [] },
                    description: 'Practice questions covering Werner\'s theory, coordination number, and ligand structure.',
                    type: 'practice',
                    instructions: 'Attempt all questions. Review detailed explanations after submission.',
                    duration: 20,
                    passingMarks: 10,
                    passingPercentage: 50,
                    isProctoringEnabled: false,
                    isAudioProctoringEnabled: false,
                    strictTabSwitching: false,
                    shuffleQuestions: true,
                    showResultImmediately: true,
                    showCorrectAnswers: true,
                    allowRetake: true,
                    maxAttempts: 5,
                    startDate: ago(15),
                    endDate: future(30),
                    isScheduled: true,
                    status: 'published',
                    isPublished: true,
                    questions: [
                        {
                            question: 'What is the coordination number of cobalt in [Co(NH3)6]Cl3?',
                            questionType: 'mcq',
                            options: [
                                { text: '6', isCorrect: true },
                                { text: '3', isCorrect: false },
                                { text: '9', isCorrect: false },
                                { text: '4', isCorrect: false }
                            ],
                            explanation: 'Cobalt is bonded directly to 6 NH3 ligands, which acts as the coordinate bonds. Hence, coordination number is 6.',
                            points: 10,
                            difficulty: 'easy',
                            tags: ['coordination', 'ligands']
                        },
                        {
                            question: 'How many geometric isomers are possible for the square planar complex [Pt(NH3)2Cl2]?',
                            questionType: 'numeric',
                            numericAnswer: 2,
                            tolerance: 0,
                            explanation: 'Two geometric isomers are possible: cis-[Pt(NH3)2Cl2] and trans-[Pt(NH3)2Cl2].',
                            points: 10,
                            difficulty: 'medium',
                            tags: ['isomerism', 'coordination']
                        },
                        {
                            question: 'Which of the following ligands is bidentate?',
                            questionType: 'mcq',
                            options: [
                                { text: 'Ethylene diamine (en)', isCorrect: true },
                                { text: 'Ammonia (NH3)', isCorrect: false },
                                { text: 'Water (H2O)', isCorrect: false },
                                { text: 'Carbon monoxide (CO)', isCorrect: false }
                            ],
                            explanation: 'Ethylene diamine has two nitrogen donor atoms capable of coordinate bonding to a single metal center simultaneously.',
                            points: 10,
                            difficulty: 'easy',
                            tags: ['ligands']
                        }
                    ]
                }
            },
            { upsert: true, new: true }
        );
        console.log(`🧪 Created/Updated Practice Chemistry Exam: ${chemExam1.title}`);

        const chemExam2 = await Exam.findOneAndUpdate(
            { courseId: chemCourse._id, title: 'Chemistry Chapter Test — Organic Mechanisms' },
            {
                $set: {
                    tutorId: snehaTutorProfile._id,
                    instituteId: apexInstituteId,
                    audience: { scope: 'institute', instituteId: apexInstituteId, batchIds: [], studentIds: [] },
                    description: 'Assessment covering SN1 and SN2 mechanistic differences, kinetics, and stereochemical outcomes.',
                    type: 'assessment',
                    instructions: 'Monitored assessment. Tab switching is strictly prohibited.',
                    duration: 30,
                    passingMarks: 10,
                    passingPercentage: 50,
                    isProctoringEnabled: true,
                    isAudioProctoringEnabled: false,
                    strictTabSwitching: true,
                    shuffleQuestions: true,
                    showResultImmediately: true,
                    showCorrectAnswers: true,
                    allowRetake: false,
                    maxAttempts: 1,
                    startDate: ago(5),
                    endDate: future(10),
                    isScheduled: true,
                    status: 'published',
                    isPublished: true,
                    questions: [
                        {
                            question: 'Which of the following undergoes SN1 reaction most rapidly?',
                            questionType: 'mcq',
                            options: [
                                { text: 'tert-Butyl chloride', isCorrect: true },
                                { text: 'Isopropyl chloride', isCorrect: false },
                                { text: 'Ethyl chloride', isCorrect: false },
                                { text: 'Methyl chloride', isCorrect: false }
                            ],
                            explanation: 'SN1 reaction goes through a carbocation intermediate. The tert-Butyl carbocation is a stable tertiary carbocation, and therefore reacts fastest.',
                            points: 10,
                            difficulty: 'easy',
                            tags: ['organic', 'sn1']
                        },
                        {
                            question: 'In a typical bimolecular nucleophilic substitution (SN2) reaction at an asymmetric carbon, what is the stereochemical outcome?',
                            questionType: 'mcq',
                            options: [
                                { text: 'Inversion of configuration (Walden inversion)', isCorrect: true },
                                { text: 'Complete racemization', isCorrect: false },
                                { text: 'Retention of configuration', isCorrect: false },
                                { text: 'Formation of diastereomer mixture', isCorrect: false }
                            ],
                            explanation: 'SN2 involves backside attack by the nucleophile, leading to complete inversion of configuration at the stereocenter.',
                            points: 10,
                            difficulty: 'medium',
                            tags: ['organic', 'sn2']
                        }
                    ]
                }
            },
            { upsert: true, new: true }
        );
        console.log(`🧪 Created/Updated Assessment Chemistry Exam: ${chemExam2.title}`);

        // Create/Update Chemistry Assignment
        const chemAssignment = await Assignment.findOneAndUpdate(
            { courseId: chemCourse._id, title: 'Chemistry Assignment — Coordination Compounds & Ligand Field Theory' },
            {
                $set: {
                    instituteId: apexInstituteId,
                    audience: { scope: 'institute', instituteId: apexInstituteId, batchIds: [], studentIds: [] },
                    moduleId: module1Id,
                    description: 'Analyze the crystal field splitting in octahedral and tetrahedral complexes. Calculate Crystal Field Stabilization Energy (CFSE) for various d-electron configurations.',
                    dueDate: future(10),
                    totalMarks: 100,
                    rubric: [
                        { criterion: 'Splitting Diagrams', description: 'Accurate drawing of t2g and eg orbital energy levels.', points: 40 },
                        { criterion: 'CFSE Calculations', description: 'Correct calculations of Crystal Field Stabilization Energy.', points: 40 },
                        { criterion: 'Neatness & Presentation', description: 'Logical steps and clear presentation.', points: 20 }
                    ],
                    status: 'published'
                }
            },
            { upsert: true, new: true }
        );
        console.log(`📝 Created/Updated Chemistry Assignment: "${chemAssignment.title}" with 10 days deadline.`);

        // Seeding Aarav's attempts for Chemistry exams
        // Attempt 1 for chemExam1
        const existingAttempt1 = await ExamAttempt.findOne({ examId: chemExam1._id, studentId: studentUser._id });
        if (!existingAttempt1) {
            await ExamAttempt.create({
                examId: chemExam1._id,
                studentId: studentUser._id,
                courseId: chemCourse._id,
                attemptNumber: 1,
                score: 20,
                percentage: 67,
                isPassed: true,
                timeSpent: 900,
                startedAt: ago(3, 0, 15),
                submittedAt: ago(3),
                answers: [
                    {
                        questionId: chemExam1.questions[0]._id,
                        selectedOption: 0,
                        selectedOptionText: '6',
                        isCorrect: true,
                        pointsEarned: 10,
                        timeTaken: 300,
                        questionData: {
                            question: chemExam1.questions[0].question,
                            options: chemExam1.questions[0].options,
                            correctOption: 0,
                            explanation: chemExam1.questions[0].explanation,
                            points: 10,
                            difficulty: 'easy',
                            questionType: 'mcq'
                        }
                    },
                    {
                        questionId: chemExam1.questions[1]._id,
                        numericAnswer: 2,
                        isCorrect: true,
                        pointsEarned: 10,
                        timeTaken: 250,
                        questionData: {
                            question: chemExam1.questions[1].question,
                            options: [],
                            correctOption: null,
                            explanation: chemExam1.questions[1].explanation,
                            points: 10,
                            difficulty: 'medium',
                            questionType: 'numeric',
                            numericAnswer: 2
                        }
                    },
                    {
                        questionId: chemExam1.questions[2]._id,
                        selectedOption: 1, // incorrect (NH3)
                        selectedOptionText: 'Ammonia (NH3)',
                        isCorrect: false,
                        pointsEarned: 0,
                        timeTaken: 350,
                        questionData: {
                            question: chemExam1.questions[2].question,
                            options: chemExam1.questions[2].options,
                            correctOption: 0,
                            explanation: chemExam1.questions[2].explanation,
                            points: 10,
                            difficulty: 'easy',
                            questionType: 'mcq'
                        }
                    }
                ],
                aiRiskScore: 0,
                aiRiskLevel: 'Safe',
                aiProctoringSummary: 'Practice set completed without proctoring flags.'
            });
            console.log(`✅ Seeded ExamAttempt for Aarav on ${chemExam1.title}`);
        }

        // Attempt 1 for chemExam2 (Chapter Test)
        const existingAttempt2 = await ExamAttempt.findOne({ examId: chemExam2._id, studentId: studentUser._id });
        if (!existingAttempt2) {
            await ExamAttempt.create({
                examId: chemExam2._id,
                studentId: studentUser._id,
                courseId: chemCourse._id,
                attemptNumber: 1,
                score: 10,
                percentage: 50,
                isPassed: true,
                timeSpent: 1200,
                startedAt: ago(1, 0, 20),
                submittedAt: ago(1),
                answers: [
                    {
                        questionId: chemExam2.questions[0]._id,
                        selectedOption: 0,
                        selectedOptionText: 'tert-Butyl chloride',
                        isCorrect: true,
                        pointsEarned: 10,
                        timeTaken: 550,
                        questionData: {
                            question: chemExam2.questions[0].question,
                            options: chemExam2.questions[0].options,
                            correctOption: 0,
                            explanation: chemExam2.questions[0].explanation,
                            points: 10,
                            difficulty: 'easy',
                            questionType: 'mcq'
                        }
                    },
                    {
                        questionId: chemExam2.questions[1]._id,
                        selectedOption: 1, // incorrect (Complete racemization)
                        selectedOptionText: 'Complete racemization',
                        isCorrect: false,
                        pointsEarned: 0,
                        timeTaken: 650,
                        questionData: {
                            question: chemExam2.questions[1].question,
                            options: chemExam2.questions[1].options,
                            correctOption: 0,
                            explanation: chemExam2.questions[1].explanation,
                            points: 10,
                            difficulty: 'medium',
                            questionType: 'mcq'
                        }
                    }
                ],
                aiRiskScore: 1,
                aiRiskLevel: 'Safe',
                aiProctoringSummary: 'Clean attempt. Minor mouse movements detected.'
            });
            console.log(`✅ Seeded ExamAttempt for Aarav on ${chemExam2.title}`);
        }

        // Enroll Aarav in React course (c2) and seed attempt for exam6
        const reactCourse = await Course.findOne({ title: { $in: ['Next.js & React Advanced Concepts', 'Advanced React Patterns & Performance'] } });
        if (reactCourse) {
            // Enroll Aarav
            await Enrollment.findOneAndUpdate(
                { studentId: studentUser._id, courseId: reactCourse._id },
                {
                    $set: {
                        status: 'active',
                        enrolledAt: ago(12),
                        'progress.completedLessons': [],
                        'progress.percentage': 0,
                        lastAccessed: new Date()
                    }
                },
                { upsert: true }
            );

            // Find Exam 6
            const exam6 = await Exam.findOne({ courseId: reactCourse._id, title: 'React Performance Optimization Assessment' });
            if (exam6) {
                const existingReactAttempt = await ExamAttempt.findOne({ examId: exam6._id, studentId: studentUser._id });
                if (!existingReactAttempt) {
                    await ExamAttempt.create({
                        examId: exam6._id,
                        studentId: studentUser._id,
                        courseId: reactCourse._id,
                        attemptNumber: 1,
                        score: 10,
                        percentage: 100,
                        isPassed: true,
                        timeSpent: 600,
                        startedAt: ago(4, 0, 10),
                        submittedAt: ago(4),
                        answers: [
                            {
                                questionId: exam6.questions[0]._id,
                                selectedOption: 0,
                                selectedOptionText: 'useMemo',
                                isCorrect: true,
                                pointsEarned: 10,
                                timeTaken: 600,
                                questionData: {
                                    question: exam6.questions[0].question,
                                    options: exam6.questions[0].options,
                                    correctOption: 0,
                                    explanation: exam6.questions[0].explanation,
                                    points: 10,
                                    difficulty: 'easy',
                                    questionType: 'mcq'
                                }
                            }
                        ],
                        aiRiskScore: 0,
                        aiRiskLevel: 'Safe',
                        aiProctoringSummary: 'No anomalies. Standard global assessment.'
                    });
                    console.log(`✅ Seeded ExamAttempt for Aarav on React Course Exam: ${exam6.title}`);
                }
            }
        }

        // Enroll Aarav in Biology course to show Biology exam on his dashboard
        const bioCourse = await Course.findOne({ title: { $in: ['NEET Biology Masterclass 2026', 'Biology Masterclass 2026'] } });
        if (bioCourse) {
            await Enrollment.findOneAndUpdate(
                { studentId: studentUser._id, courseId: bioCourse._id },
                {
                    $set: {
                        status: 'active',
                        enrolledAt: ago(15),
                        'progress.completedLessons': [],
                        'progress.percentage': 0,
                        lastAccessed: new Date()
                    }
                },
                { upsert: true }
            );
            console.log(`✅ Enrolled Aarav in Biology Course: ${bioCourse.title}`);
        } else {
            console.log(`❌ Biology Course not found for enrollment.`);
        }

        // ══════════════════════════════════════════════════════════════════════
        //  10. SEED ADDITIONAL PAYMENTS FOR AARAV, RIYA & DIYA
        // ══════════════════════════════════════════════════════════════════════
        console.log('\n💰 Seeding additional payment records...');
        const riyaUser = await User.findOne({ email: 'riya.choudhury@gmail.com' });
        const mernCourse = await Course.findOne({ title: 'Full Stack MERN Bootcamp 2026' });
        const dsaCourse = await Course.findOne({ title: 'Data Structures & Algorithms in Java' });

        const customPayments = [
            // Aarav Patel payments
            {
                student: studentUser,
                course: reactCourse,
                type: 'course_purchase',
                title: `Enrollment: Advanced React Patterns & Performance`,
                amount: 1999,
                status: 'paid',
                d: 12,
                invoice: 'INV-202606-8801'
            },
            {
                student: studentUser,
                course: chemCourse,
                type: 'course_purchase',
                title: `Enrollment: Chemistry — Organic & Coordination`,
                amount: 2499,
                status: 'paid',
                d: 6,
                invoice: 'INV-202606-8802'
            },
            {
                student: studentUser,
                course: dsaCourse,
                type: 'course_purchase',
                title: `Enrollment: Data Structures & Algorithms in Java (Failed)`,
                amount: 2999,
                status: 'failed',
                d: 8
            },
            {
                student: studentUser,
                instituteId: apexInstituteId,
                type: 'institute_fee',
                title: 'Apex Academy — Advanced Test Series Registration Fee',
                amount: 5000,
                status: 'paid',
                d: 2,
                invoice: 'INV-202606-8803'
            },
            {
                student: studentUser,
                instituteId: apexInstituteId,
                type: 'institute_fee',
                title: 'Apex Academy — July 2026 Monthly Tuition Fee',
                amount: 15000,
                status: 'created',
                d: 0,
                dueDate: future(15)
            },

            // Riya Choudhury payments
            {
                student: riyaUser,
                course: mernCourse,
                type: 'course_purchase',
                title: `Enrollment: Full Stack MERN Bootcamp 2026`,
                amount: 4999,
                status: 'paid',
                d: 10,
                invoice: 'INV-202606-8901'
            },
            {
                student: riyaUser,
                course: dsaCourse,
                type: 'course_purchase',
                title: `Enrollment: Data Structures & Algorithms in Java (Failed)`,
                amount: 2999,
                status: 'failed',
                d: 7
            },
            {
                student: riyaUser,
                instituteId: mernCourse?.instituteId, // Zenith Tech Space
                type: 'institute_fee',
                title: 'Zenith Tech Space — Monthly Fee June 2026',
                amount: 8000,
                status: 'paid',
                d: 5,
                invoice: 'INV-202606-8902'
            },

            // Diya Sharma payments
            {
                student: diyaUser,
                course: chemCourse,
                type: 'course_purchase',
                title: `Enrollment: Chemistry — Organic & Coordination`,
                amount: 2499,
                status: 'paid',
                d: 6,
                invoice: 'INV-202606-9001'
            },
            {
                student: diyaUser,
                course: await Course.findOne({ title: { $in: ['NEET Biology Masterclass 2026', 'Biology Masterclass 2026'] } }),
                type: 'course_purchase',
                title: `Enrollment: Biology Masterclass 2026`,
                amount: 2999,
                status: 'paid',
                d: 15,
                invoice: 'INV-202606-9002'
            }
        ];

        let pIndex = 5000;
        for (const p of customPayments) {
            if (p.student) {
                pIndex++;
                const searchCriteria = p.invoice
                    ? { invoiceNumber: p.invoice }
                    : {
                        studentId: p.student._id,
                        type: p.type,
                        amount: p.amount
                    };
                if (!p.invoice) {
                    if (p.course) searchCriteria.courseId = p.course._id;
                    else if (p.instituteId) searchCriteria.instituteId = p.instituteId;
                }

                await Payment.findOneAndUpdate(
                    searchCriteria,
                    {
                        $set: {
                            studentId: p.student._id,
                            type: p.type,
                            amount: p.amount,
                            courseId: p.course ? p.course._id : undefined,
                            instituteId: p.instituteId || (p.course ? p.course.instituteId : undefined),
                            title: p.title,
                            currency: 'INR',
                            status: p.status,
                            razorpayOrderId: `order_SapCustom${pIndex}`,
                            razorpayPaymentId: p.status === 'paid' ? `pay_SapCustom${pIndex}` : null,
                            razorpaySignature: p.status === 'paid' ? `sig_SapCustom${pIndex}` : null,
                            paidAt: p.status === 'paid' ? ago(p.d) : null,
                            dueDate: p.dueDate || null,
                            createdAt: ago(p.d),
                            invoiceNumber: p.invoice || undefined,
                            platformFee: p.status === 'paid' ? Math.round(p.amount * 0.1) : 0,
                            instituteEarnings: p.status === 'paid' ? Math.round(p.amount * 0.9) : 0,
                            isSettled: p.status === 'paid' ? true : false,
                            settledAt: p.status === 'paid' ? ago(Math.max(0, p.d - 1)) : null,
                            payoutReferenceId: p.status === 'paid' ? `pout_ref_CST${pIndex}` : null
                        }
                    },
                    { upsert: true, new: true }
                );
            }
        }
        console.log('✅ Payments seeded successfully.');

        // ══════════════════════════════════════════════════════════════════════
        //  11. SEED GLOBAL BATCHES
        // ══════════════════════════════════════════════════════════════════════
        console.log('\n🏫 Seeding global batches...');
        
        // Fetch other student users
        const diyaStudent = await User.findOne({ email: 'diya.sharma@gmail.com' });
        const ishaanStudent = await User.findOne({ email: 'ishaan.gupta@gmail.com' });
        const ananyaStudent = await User.findOne({ email: 'ananya.reddy@gmail.com' });
        const tanviStudent = await User.findOne({ email: 'tanvi.mishra@gmail.com' });

        // Fetch courses for global batches
        const reactCourseDoc = await Course.findOne({ title: { $in: ['Next.js & React Advanced Concepts', 'Advanced React Patterns & Performance'] } });
        const chemCourseDoc = await Course.findOne({ title: { $in: ['Chemistry — Organic Mechanisms & Coordination Compounds', 'JEE Chemistry — Organic Mechanisms & Coordination Compounds'] } });
        const mathCourseDoc = await Course.findOne({ title: { $in: ['Mathematics — Calculus & Algebra Mastery', 'JEE Maths — Calculus & Algebra Mastery'] } });
        const pythonCourseDoc = await Course.findOne({ title: 'Python for Data Science & Machine Learning' });
        const uiuxCourseDoc = await Course.findOne({ title: 'Complete UI/UX Design Thinking with Figma' });

        const globalBatchesData = [
            {
                name: 'React Advanced Cohort — Global',
                course: reactCourseDoc,
                tutorId: reactCourseDoc?.tutorId,
                scheduleDescription: 'Mon, Wed, Fri — 6:00 PM to 7:30 PM IST',
                status: 'active',
                startDate: ago(5),
                students: [diyaStudent?._id, ishaanStudent?._id].filter(Boolean)
            },
            {
                name: 'Chemistry Masterclass — Global',
                course: chemCourseDoc,
                tutorId: chemCourseDoc?.tutorId,
                scheduleDescription: 'Tue, Thu, Sat — 2:00 PM to 3:30 PM IST',
                status: 'active',
                startDate: ago(2),
                students: [ananyaStudent?._id, tanviStudent?._id].filter(Boolean)
            },
            {
                name: 'Mathematics Calculus & Algebra Cohort — Global',
                course: mathCourseDoc,
                tutorId: mathCourseDoc?.tutorId,
                scheduleDescription: 'Mon, Wed — 4:00 PM to 5:30 PM IST',
                status: 'upcoming',
                startDate: future(5),
                students: [diyaStudent?._id, tanviStudent?._id].filter(Boolean)
            },
            {
                name: 'Python Data Science Bootcamp — Global',
                course: pythonCourseDoc,
                tutorId: pythonCourseDoc?.tutorId,
                scheduleDescription: 'Tue, Thu — 7:00 PM to 8:30 PM IST',
                status: 'active',
                startDate: ago(3),
                students: [ishaanStudent?._id, ananyaStudent?._id].filter(Boolean)
            },
            {
                name: 'UI/UX Design Masterclass — Global',
                course: uiuxCourseDoc,
                tutorId: uiuxCourseDoc?.tutorId,
                scheduleDescription: 'Friday — 5:00 PM to 7:00 PM IST',
                status: 'active',
                startDate: ago(4),
                students: [tanviStudent?._id].filter(Boolean)
            }
        ];

        for (const batchData of globalBatchesData) {
            if (batchData.course && batchData.tutorId) {
                const updatedBatch = await Batch.findOneAndUpdate(
                    { name: batchData.name },
                    {
                        $set: {
                            name: batchData.name,
                            courseId: batchData.course._id,
                            tutorId: batchData.tutorId,
                            instructors: [batchData.tutorId],
                            grade: 'A',
                            instituteId: null,
                            scheduleDescription: batchData.scheduleDescription,
                            status: batchData.status,
                            startDate: batchData.startDate,
                            endDate: future(60)
                        },
                        $setOnInsert: {
                            students: batchData.students
                        }
                    },
                    { upsert: true, new: true }
                );
                console.log(`✅ Seeded batch: ${batchData.name} (ID: ${updatedBatch._id})`);
            } else {
                console.log(`⚠️ Skipped seeding batch ${batchData.name} - Course or tutor not found`);
            }
        }

        console.log('\n🎉 Additional seeding completed successfully!');
    } catch (err) {
        console.error('❌ Error in seeding:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔄 Disconnected from MongoDB.');
    }
}

run();
