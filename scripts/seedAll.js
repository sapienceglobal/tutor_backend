/**
 * ============================================================================
 *  SAPIENCE LMS & COACHING ERP — COMPREHENSIVE DATABASE SEEDER
 * ============================================================================
 *  Run:  node scripts/seedAll.js   (or:  npm run seed:all)
 *
 *  This script WIPES the entire database and populates it with ~22 realistic
 *  users, 8 courses, 4 batches, AI-proctored exams, billing data, attendance
 *  logs, leave workflows, and 35+ interconnected collections.
 *
 *  Password for ALL seeded accounts:  password123
 * ============================================================================
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

// ── Model Imports ────────────────────────────────────────────────────────────
import User from '../src/models/User.js';
import Tutor from '../src/models/Tutor.js';
import TutorProfile from '../src/models/TutorProfile.js';
import Category from '../src/models/Category.js';
import Course from '../src/models/Course.js';
import Lesson from '../src/models/Lesson.js';
import Batch from '../src/models/Batch.js';
import { Exam, ExamAttempt } from '../src/models/Exam.js';
import Payment from '../src/models/Payment.js';
import SubscriptionPlan from '../src/models/SubscriptionPlan.js';
import InstituteMembership from '../src/models/InstituteMembership.js';
import { Institute } from '../src/models/Institute.js';
import Note from '../src/models/Note.js';
import LessonComment from '../src/models/LessonComment.js';
import Enrollment from '../src/models/Enrollment.js';
import Assignment from '../src/models/Assignment.js';
import Submission from '../src/models/Submission.js';
import Appointment from '../src/models/Appointment.js';
import Review from '../src/models/Review.js';
import Progress from '../src/models/Progress.js';
import LiveClass from '../src/models/LiveClass.js';
import Attendance from '../src/models/Attendance.js';
import BatchAttendance from '../src/models/BatchAttendance.js';
import Leave from '../src/models/Leave.js';
import Certificate from '../src/models/Certificate.js';
import Notification from '../src/models/Notification.js';
import AIChatSession from '../src/models/AIChatSession.js';
import AIUsageLog from '../src/models/AIUsageLog.js';
import DoubtLog from '../src/models/DoubtLog.js';
import StudyPlan from '../src/models/StudyPlan.js';
import SimplifiedNote from '../src/models/SimplifiedNote.js';
import Wishlist from '../src/models/Wishlist.js';
import Blog from '../src/models/Blog.js';
import Lead from '../src/models/Lead.js';
import QuizAttempt from '../src/models/QuizAttempt.js';
import LearningEvent from '../src/models/LearningEvent.js';
import PayoutRequest from '../src/models/PayoutRequest.js';
import Facility from '../src/models/Facility.js';
import Settings from '../src/models/Settings.js';
import LectureSummary from '../src/models/LectureSummary.js';
import GeneratedReport from '../src/models/GeneratedReport.js';


// ── Config ───────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

// ── Helpers ──────────────────────────────────────────────────────────────────
const ago = (days, hours = 0, mins = 0) =>
    new Date(Date.now() - days * 86400000 - hours * 3600000 - mins * 60000);
const future = (days, hours = 0) =>
    new Date(Date.now() + days * 86400000 + hours * 3600000);
const oid = () => new mongoose.Types.ObjectId();

// ══════════════════════════════════════════════════════════════════════════════
// ▸  MAIN SEED FUNCTION
// ══════════════════════════════════════════════════════════════════════════════
async function seed() {
    try {
        console.log('🔄 Connecting to MongoDB at:', MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@'));
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB Connected Successfully\n');

        // ── PURGE ALL COLLECTIONS ────────────────────────────────────────────
        console.log('🗑️  Purging all collections...');
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const col of collections) {
            await mongoose.connection.db.collection(col.name).deleteMany({});
        }
        console.log(`   Cleared ${collections.length} collections.\n`);

        const hashedPassword = await bcrypt.hash('password123', 10);
        const NOW = new Date();

        // ══════════════════════════════════════════════════════════════════════
        //  1. SETTINGS (Singleton)
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [1/40] Settings...');
        await Settings.create({
            siteName: 'Sapience LMS',
            supportEmail: 'support@sapience.io',
            defaultLanguage: 'English',
            footerText: '© 2026 Sapience LMS & Coaching ERP. All rights reserved.',
            contactEmail: 'hello@sapience.io',
            contactAddress: '12-A, Sector 62, Noida, UP 201301, India',
            supportPhone: '+91-120-4567890',
            facebookLink: 'https://facebook.com/sapienceLMS',
            twitterLink: 'https://twitter.com/sapienceLMS',
            instagramLink: 'https://instagram.com/sapienceLMS',
            linkedinLink: 'https://linkedin.com/company/sapience-lms',
            youtubeLink: 'https://youtube.com/@sapienceLMS',
            maintenanceMode: false,
            allowRegistration: true,
            autoApproveCourses: false,
            autoApproveTutors: false,
            allowGuestBrowsing: true,
            platformCommission: 10,
            enableDarkMode: true,
            allowInstituteBranding: true,
            enforceGlobalTheme: false,
        });

        // ══════════════════════════════════════════════════════════════════════
        //  2. SUBSCRIPTION PLANS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [2/40] Subscription Plans...');
        const plans = await SubscriptionPlan.insertMany([
            {
                name: 'Institute Free',
                price: 0, billingCycle: 'monthly', planType: 'institute', planRole: 'all', isPopular: false,
                features: { maxTutors: 2, maxStudents: 20, storageLimitGB: 1, hlsStreaming: false, customBranding: false, zoomIntegration: false, apiAccess: false, aiAssistant: false, aiAssessment: false, aiIntelligence: false, aiCreditsPerMonth: 0 }
            },
            {
                name: 'Institute Pro',
                price: 2999, billingCycle: 'monthly', planType: 'institute', planRole: 'all', isPopular: true,
                features: { maxTutors: 20, maxStudents: 250, storageLimitGB: 50, hlsStreaming: true, customBranding: true, zoomIntegration: true, apiAccess: true, aiAssistant: true, aiAssessment: true, aiIntelligence: true, aiCreditsPerMonth: 5000 }
            },
            {
                name: 'Institute Enterprise',
                price: 9999, billingCycle: 'monthly', planType: 'institute', planRole: 'all', isPopular: false,
                features: { maxTutors: 100, maxStudents: 2000, storageLimitGB: 500, hlsStreaming: true, customBranding: true, zoomIntegration: true, apiAccess: true, aiAssistant: true, aiAssessment: true, aiIntelligence: true, aiCreditsPerMonth: 25000 }
            },
            {
                name: 'Tutor Pro',
                price: 7999, billingCycle: 'monthly', planType: 'personal', planRole: 'tutor', isPopular: true,
                features: { maxTutors: 1, maxStudents: 500, storageLimitGB: 100, hlsStreaming: true, customBranding: true, zoomIntegration: true, apiAccess: false, aiAssistant: true, aiAssessment: true, aiIntelligence: false, aiCreditsPerMonth: 8000 }
            },
            {
                name: 'Student Scholar',
                price: 999, billingCycle: 'monthly', planType: 'personal', planRole: 'student', isPopular: true,
                features: { maxTutors: 0, maxStudents: 1, storageLimitGB: 10, hlsStreaming: false, customBranding: false, zoomIntegration: false, apiAccess: false, aiAssistant: true, aiAssessment: true, aiIntelligence: false, aiCreditsPerMonth: 1500 }
            }
        ]);
        const planMap = Object.fromEntries(plans.map(p => [p.name, p]));

        // ══════════════════════════════════════════════════════════════════════
        //  3. CATEGORIES
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [3/40] Categories...');
        const categories = await Category.insertMany([
            { name: 'Web Development', icon: '🌐', description: 'Frontend & backend web technologies, MERN, Next.js, REST APIs.' },
            { name: 'Data Science & ML', icon: '📊', description: 'Python, Machine Learning, Deep Learning, Data Analysis, Pandas.' },
            { name: 'Physics', icon: '⚛️', description: 'Mechanics, Thermodynamics, Optics, Electromagnetism for JEE/NEET.' },
            { name: 'Mathematics', icon: '📐', description: 'Calculus, Algebra, Trigonometry, Vedic Mathematics, Probability.' },
            { name: 'Chemistry', icon: '🧪', description: 'Organic, Inorganic, Physical Chemistry for competitive exams.' },
            { name: 'Computer Science', icon: '💻', description: 'DSA, Operating Systems, Networking, System Design.' },
            { name: 'English', icon: '📝', description: 'Grammar, Literature, Essay Writing, IELTS Preparation.' },
            { name: 'Design', icon: '🎨', description: 'UI/UX, Figma, Adobe XD, Design Thinking, Wireframing.' }
        ]);
        const cat = Object.fromEntries(categories.map(c => [c.name, c]));

        // ══════════════════════════════════════════════════════════════════════
        //  4. USERS (22 total)
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [4/40] Users (22 accounts)...');
        const defNotif = { email: true, push: true, sms: true };

        // Helper to create User
        const mkUser = (data) => User.create({ password: hashedPassword, authProvider: 'local', isEmailVerified: true, notificationSettings: defNotif, language: 'en', ...data });

        // ── Superadmin
        const uSuperadmin = await mkUser({
            name: 'Adarsh Sharma', email: 'superadmin@sapience.io', role: 'superadmin',
            phone: '+919876543210', bio: 'Platform Superadmin — Sapience LMS & Coaching ERP.',
            profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
            address: { street: '12 Sector 62', city: 'Noida', state: 'Uttar Pradesh', zipCode: '201301', country: 'India' },
            dob: new Date('1990-05-15'), gender: 'Male',
        });

        // ── Institute Admins
        const uApexAdmin = await mkUser({
            name: 'Dr. Raghav Mehta', email: 'admin@apexacademy.in', role: 'admin',
            phone: '+918765432109', bio: 'Director & Academic Head, Apex Academy. 20+ years in coaching administration.',
            profileImage: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
            address: { street: '15, MG Road', city: 'Kota', state: 'Rajasthan', zipCode: '324005', country: 'India' },
            dob: new Date('1975-08-22'), gender: 'Male',
        });
        const uZenithAdmin = await mkUser({
            name: 'Priya Kapoor', email: 'admin@zenithtech.io', role: 'admin',
            phone: '+917654321098', bio: 'Co-Founder & Operations Head at Zenith Tech Space. Tech bootcamp specialist.',
            profileImage: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
            address: { street: 'Tower B, Cyber City', city: 'Gurugram', state: 'Haryana', zipCode: '122001', country: 'India' },
            dob: new Date('1988-11-04'), gender: 'Female',
        });

        // ── Tutors (6: 2 Apex, 2 Zenith, 2 Independent)
        const uTutorVikram = await mkUser({
            name: 'Vikram Rathore', email: 'vikram@apexacademy.in', role: 'tutor',
            phone: '+916543210987', bio: 'IIT Bombay Gold Medalist. 12+ years teaching JEE Physics & Advanced Mathematics.',
            profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
            address: { street: 'Adarsh Nagar', city: 'Kota', state: 'Rajasthan', zipCode: '324005', country: 'India' },
            dob: new Date('1982-03-14'), gender: 'Male',
        });
        const uTutorSneha = await mkUser({
            name: 'Sneha Iyer', email: 'sneha@apexacademy.in', role: 'tutor',
            phone: '+916543210986', bio: 'MBBS + MD Biochemistry. Passionate NEET mentor helping 500+ students crack medical entrances.',
            profileImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
            address: { street: '12, South Extension', city: 'New Delhi', state: 'Delhi', zipCode: '110049', country: 'India' },
            dob: new Date('1985-06-18'), gender: 'Female',
        });
        const uTutorArjun = await mkUser({
            name: 'Arjun Deshmukh', email: 'arjun@zenithtech.io', role: 'tutor',
            phone: '+915432109876', bio: 'Ex-Amazon SDE-3. Full Stack MERN specialist. Teaching 2000+ students since 2020.',
            profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
            address: { street: 'Baner Road', city: 'Pune', state: 'Maharashtra', zipCode: '411045', country: 'India' },
            dob: new Date('1990-09-02'), gender: 'Male',
        });
        const uTutorKavita = await mkUser({
            name: 'Kavita Nair', email: 'kavita@zenithtech.io', role: 'tutor',
            phone: '+915432109875', bio: 'Google-certified Android Developer & DSA coach. Competitive programming judge at CodeChef.',
            profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
            address: { street: 'Infopark Road', city: 'Kochi', state: 'Kerala', zipCode: '682030', country: 'India' },
            dob: new Date('1991-12-25'), gender: 'Female',
        });
        const uTutorRohan = await mkUser({
            name: 'Rohan Verma', email: 'rohan.verma@gmail.com', role: 'tutor',
            phone: '+914321098765', bio: 'Independent Tutor Pro creator. 500+ students across React, Next.js & UI/UX Design.',
            profileImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
            address: { street: 'HSR Layout', city: 'Bengaluru', state: 'Karnataka', zipCode: '560102', country: 'India' },
            dob: new Date('1993-07-10'), gender: 'Male',
            personalSubscription: {
                planName: 'Tutor Pro', isActive: true, subscriptionExpiresAt: future(30),
                features: { aiFeatures: true, aiCreditsPerMonth: 8000, aiUsageCount: 320, aiAssistant: true, aiAssessment: true, aiIntelligence: false, hlsStreaming: true, zoomIntegration: true }
            }
        });
        const uTutorMeera = await mkUser({
            name: 'Meera Joshi', email: 'meera.joshi@gmail.com', role: 'tutor',
            phone: '+914321098764', bio: 'Data Scientist at Flipkart turned educator. Teaching Python, ML & Deep Learning to 300+ students.',
            profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
            address: { street: 'Koramangala 4th Block', city: 'Bengaluru', state: 'Karnataka', zipCode: '560034', country: 'India' },
            dob: new Date('1992-01-30'), gender: 'Female',
            personalSubscription: {
                planName: 'Tutor Pro', isActive: true, subscriptionExpiresAt: future(25),
                features: { aiFeatures: true, aiCreditsPerMonth: 8000, aiUsageCount: 150, aiAssistant: true, aiAssessment: true, aiIntelligence: false, hlsStreaming: true, zoomIntegration: true }
            }
        });

        // ── Students (13)
        const studentBase = { role: 'student' };
        const uStudents = {};
        const studentsData = [
            { key: 'aarav',   name: 'Aarav Patel',       email: 'aarav.patel@gmail.com',       phone: '+913210987654', city: 'Mumbai',     state: 'Maharashtra',    gender: 'Male',   dob: '2003-01-20', inst: 'apex' },
            { key: 'diya',    name: 'Diya Sharma',       email: 'diya.sharma@gmail.com',       phone: '+913210987653', city: 'Jaipur',     state: 'Rajasthan',      gender: 'Female', dob: '2004-05-12', inst: 'apex' },
            { key: 'ishaan',  name: 'Ishaan Gupta',      email: 'ishaan.gupta@gmail.com',      phone: '+913210987652', city: 'Lucknow',    state: 'Uttar Pradesh',  gender: 'Male',   dob: '2003-09-08', inst: 'apex' },
            { key: 'ananya',  name: 'Ananya Reddy',      email: 'ananya.reddy@gmail.com',      phone: '+913210987651', city: 'Hyderabad',  state: 'Telangana',      gender: 'Female', dob: '2004-02-14', inst: 'apex' },
            { key: 'tanvi',   name: 'Tanvi Mishra',      email: 'tanvi.mishra@gmail.com',      phone: '+913210987660', city: 'Kota',       state: 'Rajasthan',      gender: 'Female', dob: '2003-11-05', inst: 'apex' },
            { key: 'kabir',   name: 'Kabir Singh',       email: 'kabir.singh@gmail.com',       phone: '+913210987650', city: 'Chandigarh', state: 'Punjab',         gender: 'Male',   dob: '2002-07-22', inst: 'zenith' },
            { key: 'nisha',   name: 'Nisha Agarwal',     email: 'nisha.agarwal@gmail.com',     phone: '+913210987649', city: 'Pune',       state: 'Maharashtra',    gender: 'Female', dob: '2003-03-17', inst: 'zenith' },
            { key: 'vivaan',  name: 'Vivaan Kumar',      email: 'vivaan.kumar@gmail.com',      phone: '+913210987648', city: 'Noida',      state: 'Uttar Pradesh',  gender: 'Male',   dob: '2002-10-30', inst: 'zenith' },
            { key: 'sanya',   name: 'Sanya Bhatia',      email: 'sanya.bhatia@gmail.com',      phone: '+913210987647', city: 'Gurugram',   state: 'Haryana',        gender: 'Female', dob: '2004-08-09', inst: 'zenith' },
            { key: 'riya',    name: 'Riya Choudhury',    email: 'riya.choudhury@gmail.com',    phone: '+913210987646', city: 'Kolkata',    state: 'West Bengal',    gender: 'Female', dob: '2003-06-25', inst: 'zenith' },
            { key: 'aditya',  name: 'Aditya Malhotra',   email: 'aditya.malhotra@gmail.com',   phone: '+913210987645', city: 'Delhi',      state: 'Delhi',          gender: 'Male',   dob: '2001-12-03', inst: 'none' },
            { key: 'pooja',   name: 'Pooja Saxena',      email: 'pooja.saxena@gmail.com',      phone: '+913210987644', city: 'Indore',     state: 'Madhya Pradesh', gender: 'Female', dob: '2002-04-15', inst: 'none' },
            { key: 'aryan',   name: 'Aryan Thakur',      email: 'aryan.thakur@gmail.com',      phone: '+913210987643', city: 'Dehradun',   state: 'Uttarakhand',    gender: 'Male',   dob: '2003-08-20', inst: 'none' },
        ];

        for (const s of studentsData) {
            uStudents[s.key] = await mkUser({
                ...studentBase,
                name: s.name, email: s.email, phone: s.phone,
                profileImage: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random&size=150`,
                bio: `${s.name} — Student at Sapience LMS.`,
                address: { street: 'Ward 5', city: s.city, state: s.state, zipCode: '000000', country: 'India' },
                dob: new Date(s.dob), gender: s.gender,
                parentDetails: [{ firstName: 'Parent', lastName: s.name.split(' ')[1], email: `parent.${s.key}@gmail.com`, phone: '+919000000000' }],
                ...(s.inst === 'none' && s.key === 'aditya' ? {
                    personalSubscription: {
                        planName: 'Student Scholar', isActive: true, subscriptionExpiresAt: future(20),
                        features: { aiFeatures: true, aiCreditsPerMonth: 1500, aiUsageCount: 45, aiAssistant: true, aiAssessment: true, aiIntelligence: false, hlsStreaming: false, zoomIntegration: false }
                    }
                } : {})
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        //  5. INSTITUTES
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [5/40] Institutes...');
        const apexInstitute = await Institute.create({
            name: 'Apex Academy', subdomain: 'apex', contactEmail: 'contact@apexacademy.in',
            logo: 'https://images.unsplash.com/photo-1562774053-701939374585?w=200&auto=format&fit=crop&q=80',
            subscriptionPlan: 'Institute Enterprise', superadminId: uSuperadmin._id,
            subscriptionExpiresAt: future(90), isActive: true,
            features: {
                hlsStreaming: true, customBranding: true, zoomIntegration: true,
                aiFeatures: true, aiCreditsPerMonth: 25000, aiAssistant: true, aiAssessment: true, aiIntelligence: true,
                manageTutors: true, manageStudents: true, maxTutors: 100, maxStudents: 2000,
                customDomain: true, advancedAnalytics: true, apiAccess: true, allowGlobalPublishingByInstituteTutors: true
            },
            brandColors: { primary: '#4F46E5', secondary: '#10B981', accent: '#6366F1', sidebar: '#1E1B4B' },
            studentTheme: { primaryColor: '#4F46E5', secondaryColor: '#F3F4F6', accentColor: '#6366F1', sidebarColor: '#1E1B4B', fontFamily: "'DM Sans', sans-serif", fontSize: '14' },
            tutorTheme: { primaryColor: '#EF4444', secondaryColor: '#FFF5F5', accentColor: '#F87171', sidebarColor: '#111827', fontFamily: "'DM Sans', sans-serif", fontSize: '14' },
            themeSettings: { useGlobalTheme: false, fontFamily: "'DM Sans', sans-serif", fontSize: '14' },
            aiUsageQuota: 25000, aiUsageCount: 1420, customDomain: 'apex.sapience.io'
        });

        const zenithInstitute = await Institute.create({
            name: 'Zenith Tech Space', subdomain: 'zenith', contactEmail: 'info@zenithtech.io',
            logo: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=200&auto=format&fit=crop&q=80',
            subscriptionPlan: 'Institute Pro', superadminId: uSuperadmin._id,
            subscriptionExpiresAt: future(30), isActive: true,
            features: {
                hlsStreaming: true, customBranding: true, zoomIntegration: true,
                aiFeatures: true, aiCreditsPerMonth: 5000, aiAssistant: true, aiAssessment: true, aiIntelligence: true,
                manageTutors: true, manageStudents: true, maxTutors: 20, maxStudents: 250,
                customDomain: false, advancedAnalytics: false, apiAccess: true, allowGlobalPublishingByInstituteTutors: false
            },
            brandColors: { primary: '#F97316', secondary: '#3B82F6', accent: '#FB923C', sidebar: '#0F172A' },
            studentTheme: { primaryColor: '#F97316', secondaryColor: '#FFF7ED', accentColor: '#FB923C', sidebarColor: '#0F172A', fontFamily: "'DM Sans', sans-serif", fontSize: '14' },
            tutorTheme: { primaryColor: '#3B82F6', secondaryColor: '#EFF6FF', accentColor: '#60A5FA', sidebarColor: '#1E293B', fontFamily: "'DM Sans', sans-serif", fontSize: '14' },
            themeSettings: { useGlobalTheme: false, fontFamily: "'DM Sans', sans-serif", fontSize: '14' },
            aiUsageQuota: 5000, aiUsageCount: 380, customDomain: null
        });

        // ── Backpatch User.instituteId ────────────────────────────────────────
        console.log('🌱 [6/40] Backpatching user.instituteId...');
        const apexUserIds = [uApexAdmin, uTutorVikram, uTutorSneha, uStudents.aarav, uStudents.diya, uStudents.ishaan, uStudents.ananya, uStudents.tanvi].map(u => u._id);
        const zenithUserIds = [uZenithAdmin, uTutorArjun, uTutorKavita, uStudents.kabir, uStudents.nisha, uStudents.vivaan, uStudents.sanya, uStudents.riya].map(u => u._id);

        await User.updateMany({ _id: { $in: apexUserIds } }, { $set: { instituteId: apexInstitute._id } });
        await User.updateMany({ _id: { $in: zenithUserIds } }, { $set: { instituteId: zenithInstitute._id } });

        // ══════════════════════════════════════════════════════════════════════
        //  7. FACILITIES
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [7/40] Facilities...');
        const apexFacility = await Facility.create({
            instituteId: apexInstitute._id, campusName: 'Apex Main Campus — Kota',
            branchCode: 'APX-KOTA-01',
            address: { street: '15, MG Road', city: 'Kota', state: 'Rajasthan', zipCode: '324005', country: 'India' },
            contactPerson: 'Dr. Raghav Mehta', contactEmail: 'campus@apexacademy.in', contactPhone: '+918765432109',
            categories: ['Engineering', 'Medical'], status: 'active',
        });
        await Facility.create({
            instituteId: zenithInstitute._id, campusName: 'Zenith Cyber Hub — Gurugram',
            branchCode: 'ZNT-GGN-01',
            address: { street: 'Tower B, Cyber City', city: 'Gurugram', state: 'Haryana', zipCode: '122001', country: 'India' },
            contactPerson: 'Priya Kapoor', contactEmail: 'campus@zenithtech.io', contactPhone: '+917654321098',
            categories: ['Engineering', 'Others'], status: 'active',
        });

        // Assign branches to some students
        await User.findByIdAndUpdate(uStudents.aarav._id, { assignedBranch: apexFacility._id });
        await User.findByIdAndUpdate(uStudents.diya._id, { assignedBranch: apexFacility._id });

        // ══════════════════════════════════════════════════════════════════════
        //  8. INSTITUTE MEMBERSHIPS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [8/40] Institute Memberships...');
        const membershipData = [
            // Apex
            { userId: uApexAdmin._id, instituteId: apexInstitute._id, roleInInstitute: 'admin', status: 'active', joinedVia: 'system_created' },
            { userId: uTutorVikram._id, instituteId: apexInstitute._id, roleInInstitute: 'tutor', status: 'active', joinedVia: 'admin_add', permissions: { canCreateCourses: true, canCreateExams: true, canViewAnalytics: true, canManageStudents: false } },
            { userId: uTutorSneha._id, instituteId: apexInstitute._id, roleInInstitute: 'tutor', status: 'active', joinedVia: 'admin_add', permissions: { canCreateCourses: true, canCreateExams: true, canViewAnalytics: true, canManageStudents: false } },
            { userId: uStudents.aarav._id, instituteId: apexInstitute._id, roleInInstitute: 'student', status: 'active', joinedVia: 'subdomain', metadata: { rollNumber: 'APX-2026-001' } },
            { userId: uStudents.diya._id, instituteId: apexInstitute._id, roleInInstitute: 'student', status: 'active', joinedVia: 'subdomain', metadata: { rollNumber: 'APX-2026-002' } },
            { userId: uStudents.ishaan._id, instituteId: apexInstitute._id, roleInInstitute: 'student', status: 'active', joinedVia: 'invite', metadata: { rollNumber: 'APX-2026-003' } },
            { userId: uStudents.ananya._id, instituteId: apexInstitute._id, roleInInstitute: 'student', status: 'active', joinedVia: 'subdomain', metadata: { rollNumber: 'APX-2026-004' } },
            { userId: uStudents.tanvi._id, instituteId: apexInstitute._id, roleInInstitute: 'student', status: 'active', joinedVia: 'subdomain', metadata: { rollNumber: 'APX-2026-005' } },
            // Zenith
            { userId: uZenithAdmin._id, instituteId: zenithInstitute._id, roleInInstitute: 'admin', status: 'active', joinedVia: 'system_created' },
            { userId: uTutorArjun._id, instituteId: zenithInstitute._id, roleInInstitute: 'tutor', status: 'active', joinedVia: 'admin_add', permissions: { canCreateCourses: true, canCreateExams: true, canViewAnalytics: true, canManageStudents: true } },
            { userId: uTutorKavita._id, instituteId: zenithInstitute._id, roleInInstitute: 'tutor', status: 'active', joinedVia: 'admin_add', permissions: { canCreateCourses: true, canCreateExams: true, canViewAnalytics: false, canManageStudents: false } },
            { userId: uStudents.kabir._id, instituteId: zenithInstitute._id, roleInInstitute: 'student', status: 'active', joinedVia: 'subdomain', metadata: { rollNumber: 'ZNT-2026-001' } },
            { userId: uStudents.nisha._id, instituteId: zenithInstitute._id, roleInInstitute: 'student', status: 'active', joinedVia: 'subdomain', metadata: { rollNumber: 'ZNT-2026-002' } },
            { userId: uStudents.vivaan._id, instituteId: zenithInstitute._id, roleInInstitute: 'student', status: 'active', joinedVia: 'invite', metadata: { rollNumber: 'ZNT-2026-003' } },
            { userId: uStudents.sanya._id, instituteId: zenithInstitute._id, roleInInstitute: 'student', status: 'active', joinedVia: 'subdomain', metadata: { rollNumber: 'ZNT-2026-004' } },
            { userId: uStudents.riya._id, instituteId: zenithInstitute._id, roleInInstitute: 'student', status: 'active', joinedVia: 'invite', metadata: { rollNumber: 'ZNT-2026-X01' } },
        ];
        await InstituteMembership.insertMany(membershipData);

        // ══════════════════════════════════════════════════════════════════════
        //  9. TUTORS + TUTOR PROFILES
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [9/40] Tutors & TutorProfiles...');
        const defNotifPref = { enrollment: true, reviews: true, summary: true, promotions: false };

        const tVikram = await Tutor.create({
            userId: uTutorVikram._id, instituteId: apexInstitute._id, categoryId: cat['Physics']._id,
            hourlyRate: 200, experience: 12, rating: 4.9, studentsCount: 340,
            subjects: ['JEE Physics', 'Mechanics', 'Thermodynamics', 'Electromagnetism', 'Modern Physics'],
            bio: 'IIT Bombay Gold Medalist. 12+ years teaching JEE Physics.', title: 'Senior Physics Faculty',
            website: 'https://vikramphysics.in', location: 'Kota, Rajasthan',
            notificationPreferences: defNotifPref, isVerified: true,
        });
        const tSneha = await Tutor.create({
            userId: uTutorSneha._id, instituteId: apexInstitute._id, categoryId: cat['Chemistry']._id,
            hourlyRate: 180, experience: 10, rating: 4.7, studentsCount: 280,
            subjects: ['NEET Biology', 'Organic Chemistry', 'Biochemistry', 'Human Physiology'],
            bio: 'MBBS + MD Biochemistry. Passionate NEET mentor.', title: 'NEET Biology & Chemistry Expert',
            location: 'New Delhi', notificationPreferences: defNotifPref, isVerified: true,
        });
        const tArjun = await Tutor.create({
            userId: uTutorArjun._id, instituteId: zenithInstitute._id, categoryId: cat['Web Development']._id,
            hourlyRate: 250, experience: 8, rating: 4.8, studentsCount: 520,
            subjects: ['MERN Stack', 'Node.js', 'React.js', 'MongoDB', 'Next.js', 'TypeScript'],
            bio: 'Ex-Amazon SDE-3. Full Stack MERN specialist.', title: 'Lead MERN Instructor',
            website: 'https://arjundev.io', location: 'Pune, Maharashtra',
            notificationPreferences: defNotifPref, isVerified: true,
        });
        const tKavita = await Tutor.create({
            userId: uTutorKavita._id, instituteId: zenithInstitute._id, categoryId: cat['Computer Science']._id,
            hourlyRate: 220, experience: 7, rating: 4.6, studentsCount: 195,
            subjects: ['Data Structures', 'Algorithms', 'Java', 'Competitive Programming', 'System Design'],
            bio: 'Google-certified developer & DSA coach.', title: 'DSA & Competitive Programming Coach',
            location: 'Kochi, Kerala', notificationPreferences: defNotifPref, isVerified: true,
        });
        const tRohanV = await Tutor.create({
            userId: uTutorRohan._id, categoryId: cat['Design']._id,
            hourlyRate: 300, experience: 6, rating: 4.8, studentsCount: 150,
            subjects: ['UI/UX Design', 'Figma', 'React.js', 'Design Systems', 'CSS Architecture'],
            bio: 'Independent Tutor Pro creator. React + Design.', title: 'Product Design & React Mentor',
            website: 'https://rohanverma.design', location: 'Bengaluru, Karnataka',
            notificationPreferences: defNotifPref, isVerified: true,
        });
        const tMeera = await Tutor.create({
            userId: uTutorMeera._id, categoryId: cat['Data Science & ML']._id,
            hourlyRate: 280, experience: 5, rating: 4.5, studentsCount: 120,
            subjects: ['Python', 'Machine Learning', 'Deep Learning', 'Pandas', 'TensorFlow', 'NLP'],
            bio: 'Flipkart Data Scientist turned educator.', title: 'Data Science & ML Instructor',
            location: 'Bengaluru, Karnataka', notificationPreferences: defNotifPref, isVerified: true,
        });

        // TutorProfiles
        const mkProfile = (userId, tutor, vis, expertise, edu) => TutorProfile.create({
            userId, bio: tutor.bio, hourlyRate: tutor.hourlyRate,
            ratings: { average: tutor.rating, count: Math.floor(Math.random() * 30) + 5 },
            totalStudents: tutor.studentsCount, totalSessions: Math.floor(tutor.studentsCount * 0.6),
            profileVisibility: vis, expertise, education: edu, isActive: true,
        });
        await mkProfile(uTutorVikram._id, tVikram, 'institute', [
            { subject: 'JEE Physics', level: 'advanced', experience: 12 },
            { subject: 'Mechanics', level: 'advanced', experience: 10 },
        ], [{ degree: 'B.Tech + M.Tech (Dual)', institution: 'IIT Bombay', year: 2010, field: 'Engineering Physics' }]);
        await mkProfile(uTutorSneha._id, tSneha, 'institute', [
            { subject: 'NEET Biology', level: 'advanced', experience: 10 },
            { subject: 'Organic Chemistry', level: 'intermediate', experience: 8 },
        ], [{ degree: 'MBBS + MD', institution: 'AIIMS Delhi', year: 2012, field: 'Biochemistry' }]);
        await mkProfile(uTutorArjun._id, tArjun, 'institute', [
            { subject: 'MERN Stack', level: 'advanced', experience: 8 },
            { subject: 'System Design', level: 'advanced', experience: 6 },
        ], [{ degree: 'B.Tech CSE', institution: 'NIT Trichy', year: 2014, field: 'Computer Science' }]);
        await mkProfile(uTutorKavita._id, tKavita, 'institute', [
            { subject: 'DSA', level: 'advanced', experience: 7 },
            { subject: 'Java', level: 'advanced', experience: 7 },
        ], [{ degree: 'M.Tech CSE', institution: 'IIT Madras', year: 2016, field: 'Algorithms' }]);
        await mkProfile(uTutorRohan._id, tRohanV, 'public', [
            { subject: 'UI/UX Design', level: 'advanced', experience: 6 },
            { subject: 'React.js', level: 'advanced', experience: 5 },
        ], [{ degree: 'B.Des', institution: 'NID Ahmedabad', year: 2017, field: 'Interaction Design' }]);
        await mkProfile(uTutorMeera._id, tMeera, 'public', [
            { subject: 'Machine Learning', level: 'advanced', experience: 5 },
            { subject: 'Python', level: 'advanced', experience: 6 },
        ], [{ degree: 'M.Sc Data Science', institution: 'ISI Kolkata', year: 2018, field: 'Statistics & ML' }]);

        // Update category tutor counts
        await Category.findByIdAndUpdate(cat['Physics']._id, { $inc: { tutorCount: 1 } });
        await Category.findByIdAndUpdate(cat['Chemistry']._id, { $inc: { tutorCount: 1 } });
        await Category.findByIdAndUpdate(cat['Web Development']._id, { $inc: { tutorCount: 1 } });
        await Category.findByIdAndUpdate(cat['Computer Science']._id, { $inc: { tutorCount: 1 } });
        await Category.findByIdAndUpdate(cat['Design']._id, { $inc: { tutorCount: 1 } });
        await Category.findByIdAndUpdate(cat['Data Science & ML']._id, { $inc: { tutorCount: 1 } });

        // ══════════════════════════════════════════════════════════════════════
        //  10. COURSES (8 courses)
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [10/40] Courses (8 courses with modules)...');
        const SAMPLE_VIDEO = 'https://res.cloudinary.com/dmep4qjdi/video/upload/sp_auto/pg_1/v1781349132/tutor-app-hls/h1qrpvp6vsh5sjooihjs.mp4dv';

        // C1: Full Stack MERN Bootcamp 2026 (Zenith, Arjun)
        const c1 = await Course.create({
            title: 'Full Stack MERN Bootcamp 2026', description: 'Master MongoDB, Express.js, React.js, and Node.js from scratch. Build 5 production-grade projects including an e-commerce platform, real-time chat app, and a social media dashboard with authentication, payments, and deployment.',
            thumbnail: 'https://images.unsplash.com/photo-1547658719-da2b81169d7a?w=800&auto=format&fit=crop&q=60',
            categoryId: cat['Web Development']._id, tutorId: tArjun._id, instituteId: zenithInstitute._id, createdBy: uTutorArjun._id,
            visibility: 'institute', audience: { scope: 'institute', instituteId: zenithInstitute._id, batchIds: [], studentIds: [] },
            price: 4999, isFree: false, level: 'beginner', duration: 60, language: 'English', status: 'published',
            requirements: ['Basic HTML/CSS knowledge', 'Familiarity with JavaScript ES6+ syntax', 'A laptop with Node.js installed'],
            whatYouWillLearn: ['Build full-stack apps with MongoDB, Express, React & Node', 'Implement JWT authentication & role-based access control', 'Deploy on AWS/Vercel with CI/CD pipelines', 'Real-time features with Socket.io & WebRTC'],
            modules: [
                { title: 'JavaScript Foundations & ES6+', description: 'Arrow functions, destructuring, promises, async/await, modules.', order: 1 },
                { title: 'Backend with Node.js & Express', description: 'REST APIs, middleware, MongoDB + Mongoose ODM, JWT auth.', order: 2 },
                { title: 'Frontend with React.js', description: 'Components, hooks, state management, routing, Axios integration.', order: 3 },
            ],
            announcements: [{ title: '🚀 Bootcamp Kickoff!', message: 'Welcome to Cohort 7! Live orientation session is this Saturday at 10 AM IST.', createdAt: ago(5) }],
            enrolledCount: 6, rating: 4.8, reviewCount: 4,
        });

        // C2: Advanced React Patterns (Independent, Rohan)
        const c2 = await Course.create({
            title: 'Advanced React Patterns & Performance', description: 'Deep dive into compound components, render props, custom hooks, React.memo, useMemo, useCallback, code splitting, lazy loading, and profiling techniques. Learn patterns used at top tech companies.',
            thumbnail: 'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=800&auto=format&fit=crop&q=60',
            categoryId: cat['Web Development']._id, tutorId: tRohanV._id, createdBy: uTutorRohan._id,
            visibility: 'public', audience: { scope: 'global', instituteId: null, batchIds: [], studentIds: [] },
            price: 1999, isFree: false, level: 'advanced', duration: 25, language: 'English', status: 'published',
            requirements: ['Solid React fundamentals (hooks, state, props)', 'Experience building at least 2 React projects'],
            whatYouWillLearn: ['Compound component & render props patterns', 'Performance optimization with React Profiler', 'Custom hook architecture for reusable logic', 'Code splitting & lazy loading strategies'],
            modules: [
                { title: 'Advanced Component Patterns', description: 'Compound components, render props, HOCs, slots.', order: 1 },
                { title: 'Performance Optimization', description: 'Memoization, virtualization, bundle analysis.', order: 2 },
            ],
            enrolledCount: 3, rating: 4.7, reviewCount: 2,
        });

        // C3: IIT JEE Physics Crash Course (Apex, Vikram)
        const c3 = await Course.create({
            title: 'IIT JEE Physics Crash Course 2026', description: 'Intensive 45-day crash course covering all 20 chapters of JEE Main & Advanced Physics. Includes 500+ solved numericals, previous year papers, and weekly mock tests with detailed solutions.',
            thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=60',
            categoryId: cat['Physics']._id, tutorId: tVikram._id, instituteId: apexInstitute._id, createdBy: uTutorVikram._id,
            visibility: 'institute', audience: { scope: 'institute', instituteId: apexInstitute._id, batchIds: [], studentIds: [] },
            price: 3499, isFree: false, level: 'advanced', duration: 45, language: 'English', status: 'published',
            requirements: ['Class 11 Physics completed', 'Basic calculus knowledge (derivatives & integration)'],
            whatYouWillLearn: ['Master all 20 JEE Physics chapters', 'Solve 500+ numericals with shortcut methods', 'Analyze previous year JEE papers (2015-2025)', 'Score 90+ in JEE Main Physics section'],
            modules: [
                { title: 'Mechanics & Kinematics', description: 'Newton\'s laws, projectile motion, circular motion, rotational mechanics.', order: 1 },
                { title: 'Electromagnetism & Modern Physics', description: 'Coulomb\'s law, capacitors, electromagnetic induction, photoelectric effect.', order: 2 },
                { title: 'Thermodynamics & Waves', description: 'Heat engines, entropy, wave optics, sound waves.', order: 3 },
            ],
            enrolledCount: 5, rating: 4.9, reviewCount: 3,
        });

        // C4: DSA in Java (Zenith, Kavita)
        const c4 = await Course.create({
            title: 'Data Structures & Algorithms in Java', description: 'Complete DSA roadmap from arrays to graphs. Covers 300+ LeetCode problems with detailed Java solutions, time complexity analysis, and pattern recognition strategies for FAANG interviews.',
            thumbnail: 'https://images.unsplash.com/photo-1515879218367-8466d910auj7?w=800&auto=format&fit=crop&q=60',
            categoryId: cat['Computer Science']._id, tutorId: tKavita._id, instituteId: zenithInstitute._id, createdBy: uTutorKavita._id,
            visibility: 'institute', audience: { scope: 'institute', instituteId: zenithInstitute._id, batchIds: [], studentIds: [] },
            price: 2999, isFree: false, level: 'intermediate', duration: 40, language: 'English', status: 'published',
            requirements: ['Java basics (OOP, collections)', 'Understanding of Big-O notation'],
            whatYouWillLearn: ['Master arrays, linked lists, stacks, queues, trees, graphs', 'Solve 300+ LeetCode problems categorized by pattern', 'Dynamic programming & greedy algorithm patterns', 'Mock interview preparation for FAANG companies'],
            modules: [
                { title: 'Linear Data Structures', description: 'Arrays, strings, linked lists, stacks, queues.', order: 1 },
                { title: 'Trees & Graphs', description: 'BST, AVL, heaps, BFS, DFS, shortest path.', order: 2 },
                { title: 'Dynamic Programming', description: 'Memoization, tabulation, classic DP problems.', order: 3 },
            ],
            enrolledCount: 4, rating: 4.6, reviewCount: 2,
        });

        // C5: NEET Biology Masterclass (Apex, Sneha)
        const c5 = await Course.create({
            title: 'NEET Biology Masterclass 2026', description: 'Complete NEET Biology preparation covering Botany & Zoology. Includes NCERT line-by-line analysis, 1000+ MCQs, diagram-based questions, and assertion-reasoning practice.',
            thumbnail: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=60',
            categoryId: cat['Chemistry']._id, tutorId: tSneha._id, instituteId: apexInstitute._id, createdBy: uTutorSneha._id,
            visibility: 'institute', audience: { scope: 'institute', instituteId: apexInstitute._id, batchIds: [], studentIds: [] },
            price: 2999, isFree: false, level: 'intermediate', duration: 50, language: 'English', status: 'published',
            requirements: ['Class 11 Biology completed', 'NCERT textbooks (Class 11 & 12)'],
            whatYouWillLearn: ['NCERT line-by-line analysis for NEET', 'Solve 1000+ MCQs with explanations', 'Master diagram-based & assertion-reasoning questions', 'Score 340+ in NEET Biology section'],
            modules: [
                { title: 'Cell Biology & Genetics', description: 'Cell structure, cell cycle, Mendelian genetics, molecular biology.', order: 1 },
                { title: 'Human Physiology', description: 'Digestion, respiration, circulation, excretion, neural control.', order: 2 },
            ],
            enrolledCount: 4, rating: 4.7, reviewCount: 2,
        });

        // C6: Python for Data Science (Independent, Meera)
        const c6 = await Course.create({
            title: 'Python for Data Science & Machine Learning', description: 'From Python basics to building ML models. Covers NumPy, Pandas, Matplotlib, Scikit-learn, and introductory Deep Learning with TensorFlow. Includes 10 real-world datasets and 5 capstone projects.',
            thumbnail: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=800&auto=format&fit=crop&q=60',
            categoryId: cat['Data Science & ML']._id, tutorId: tMeera._id, createdBy: uTutorMeera._id,
            visibility: 'public', audience: { scope: 'global', instituteId: null, batchIds: [], studentIds: [] },
            price: 2499, isFree: false, level: 'beginner', duration: 35, language: 'English', status: 'published',
            requirements: ['No prior programming experience needed', 'Basic mathematics (high school level)'],
            whatYouWillLearn: ['Python programming from zero to proficient', 'Data manipulation with NumPy & Pandas', 'Data visualization with Matplotlib & Seaborn', 'Build ML models with Scikit-learn & TensorFlow'],
            modules: [
                { title: 'Python Fundamentals', description: 'Variables, control flow, functions, OOP, file handling.', order: 1 },
                { title: 'Data Analysis & Visualization', description: 'NumPy arrays, Pandas DataFrames, Matplotlib charts.', order: 2 },
                { title: 'Machine Learning', description: 'Regression, classification, clustering, model evaluation.', order: 3 },
            ],
            enrolledCount: 3, rating: 4.5, reviewCount: 1,
        });

        // C7: UI/UX Design Thinking (Independent, Rohan)
        const c7 = await Course.create({
            title: 'Complete UI/UX Design Thinking with Figma', description: 'Learn the design thinking process from empathy mapping to high-fidelity prototyping. Master Figma auto-layout, design systems, responsive grids, and handoff to developers.',
            thumbnail: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?w=800&auto=format&fit=crop&q=60',
            categoryId: cat['Design']._id, tutorId: tRohanV._id, createdBy: uTutorRohan._id,
            visibility: 'public', audience: { scope: 'global', instituteId: null, batchIds: [], studentIds: [] },
            price: 0, isFree: true, level: 'beginner', duration: 15, language: 'English', status: 'published',
            requirements: ['No prior design experience needed', 'Create a free Figma account'],
            whatYouWillLearn: ['Design thinking methodology (Empathize → Define → Ideate → Prototype → Test)', 'Figma auto-layout, components, and variants', 'Create a complete design system from scratch', 'Developer handoff best practices'],
            modules: [
                { title: 'Design Thinking Foundations', description: 'Empathy mapping, user personas, journey maps.', order: 1 },
                { title: 'Figma Mastery', description: 'Auto-layout, components, variants, prototyping.', order: 2 },
            ],
            enrolledCount: 2, rating: 4.8, reviewCount: 1,
        });

        // C8: JEE Maths (Apex, Vikram)
        const c8 = await Course.create({
            title: 'JEE Maths — Calculus & Algebra Mastery', description: 'Comprehensive JEE Mathematics covering Differential & Integral Calculus, Matrices, Determinants, Quadratic Equations, Sequences & Series. Includes 400+ solved problems with Vikram sir\'s shortcut techniques.',
            thumbnail: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&auto=format&fit=crop&q=60',
            categoryId: cat['Mathematics']._id, tutorId: tVikram._id, instituteId: apexInstitute._id, createdBy: uTutorVikram._id,
            visibility: 'institute', audience: { scope: 'institute', instituteId: apexInstitute._id, batchIds: [], studentIds: [] },
            price: 2999, isFree: false, level: 'advanced', duration: 40, language: 'English', status: 'published',
            requirements: ['Class 11 Mathematics completed', 'Trigonometry basics'],
            whatYouWillLearn: ['Master Differential & Integral Calculus for JEE', 'Solve complex Algebra problems in under 2 minutes', 'Application of matrices & determinants in JEE Advanced', 'Score 80+ in JEE Main Mathematics'],
            modules: [
                { title: 'Differential Calculus', description: 'Limits, continuity, differentiability, application of derivatives.', order: 1 },
                { title: 'Integral Calculus', description: 'Indefinite & definite integrals, area under curves.', order: 2 },
            ],
            enrolledCount: 4, rating: 4.8, reviewCount: 2,
        });

        const courses = [c1, c2, c3, c4, c5, c6, c7, c8];

        // ══════════════════════════════════════════════════════════════════════
        //  11. LESSONS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [11/40] Lessons...');

        const mkLesson = (courseId, moduleId, title, desc, type, order, isFree, content = {}) => ({
            courseId, moduleId, title, description: desc, type, order, isFree, isPublished: true,
            content: type === 'video' ? { videoUrl: SAMPLE_VIDEO, duration: 900 + Math.floor(Math.random() * 600), videoSize: 120000000 + Math.floor(Math.random() * 80000000), ...content } : content,
        });

        // C1 Lessons (MERN Bootcamp)
        const c1Lessons = await Lesson.insertMany([
            mkLesson(c1._id, c1.modules[0]._id, 'JavaScript ES6+ Deep Dive', 'Master arrow functions, destructuring, spread/rest, template literals, and module imports/exports.', 'video', 1, true),
            mkLesson(c1._id, c1.modules[0]._id, 'Promises, Async/Await & Error Handling', 'Understand the JavaScript event loop, promise chaining, async/await patterns, and robust error handling.', 'video', 2, false),
            mkLesson(c1._id, c1.modules[1]._id, 'Building REST APIs with Express.js', 'Create a production-grade REST API with Express, middleware, validation, and error handling.', 'video', 1, false),
            mkLesson(c1._id, c1.modules[1]._id, 'MongoDB & Mongoose ODM Mastery', 'Schema design, CRUD operations, aggregation pipeline, indexing, and population.', 'video', 2, false),
            mkLesson(c1._id, c1.modules[1]._id, 'Quiz: Backend Fundamentals', 'Test your Node.js & Express knowledge.', 'quiz', 3, false, {
                quiz: { title: 'Backend Fundamentals Quiz', description: 'Assessment on Express.js middleware and MongoDB queries.', passingScore: 70, timeLimit: 15, shuffleQuestions: false, shuffleOptions: false, showCorrectAnswers: true, allowRetake: true, maxAttempts: 3,
                    questions: [
                        { question: 'What does app.use() do in Express.js?', options: [{ text: 'Registers a route handler', isCorrect: false }, { text: 'Mounts middleware functions', isCorrect: true }, { text: 'Starts the server', isCorrect: false }, { text: 'Connects to database', isCorrect: false }], explanation: 'app.use() mounts middleware that runs for every request to the specified path.', points: 5 },
                        { question: 'Which Mongoose method is used to find a document by ID and update it?', options: [{ text: 'Model.findOneAndUpdate()', isCorrect: false }, { text: 'Model.findByIdAndUpdate()', isCorrect: true }, { text: 'Model.updateById()', isCorrect: false }, { text: 'Model.patchById()', isCorrect: false }], explanation: 'findByIdAndUpdate() is a shorthand that takes an _id and update object.', points: 5 },
                    ]
                }
            }),
            mkLesson(c1._id, c1.modules[2]._id, 'React Hooks Deep Dive', 'useState, useEffect, useRef, useContext, custom hooks, and hook composition patterns.', 'video', 1, false),
            mkLesson(c1._id, c1.modules[2]._id, 'State Management & API Integration', 'Context API vs Redux, Axios interceptors, SWR/TanStack Query for server state.', 'video', 2, false),
        ]);

        // C2 Lessons (React Patterns)
        const c2Lessons = await Lesson.insertMany([
            mkLesson(c2._id, c2.modules[0]._id, 'Compound Component Pattern', 'Build flexible, composable UI components using the compound component pattern with React context.', 'video', 1, true),
            mkLesson(c2._id, c2.modules[0]._id, 'Render Props & Custom Hooks', 'Extract reusable logic using render props and modern custom hook patterns.', 'video', 2, false),
            mkLesson(c2._id, c2.modules[1]._id, 'React.memo, useMemo & useCallback', 'Prevent unnecessary re-renders with memoization strategies and when to use each.', 'video', 1, false),
            mkLesson(c2._id, c2.modules[1]._id, 'Code Splitting & React.lazy', 'Reduce initial bundle size with dynamic imports, Suspense boundaries, and route-based splitting.', 'video', 2, false),
        ]);

        // C3 Lessons (JEE Physics)
        const c3Lessons = await Lesson.insertMany([
            mkLesson(c3._id, c3.modules[0]._id, 'Newton\'s Laws of Motion — JEE Advanced', 'Complete analysis of Newton\'s 3 laws with 50+ solved JEE numericals including constraint relations.', 'video', 1, true),
            mkLesson(c3._id, c3.modules[0]._id, 'Rotational Mechanics & Moment of Inertia', 'Torque, angular momentum, parallel axis theorem, and rolling without slipping problems.', 'video', 2, false),
            mkLesson(c3._id, c3.modules[1]._id, 'Electromagnetic Induction & Faraday\'s Law', 'Lenz\'s law, self & mutual inductance, eddy currents, and AC generator problems.', 'video', 1, false),
            mkLesson(c3._id, c3.modules[2]._id, 'Wave Optics & Interference', 'Young\'s double slit experiment, diffraction, polarization, and related JEE problems.', 'video', 1, false),
        ]);

        // C4 Lessons (DSA Java)
        const c4Lessons = await Lesson.insertMany([
            mkLesson(c4._id, c4.modules[0]._id, 'Arrays & Two Pointer Technique', 'Master array manipulation, sliding window, and two-pointer patterns with 30+ LeetCode problems.', 'video', 1, true),
            mkLesson(c4._id, c4.modules[0]._id, 'Linked Lists — Singly, Doubly & Circular', 'Implementation, reversal, cycle detection (Floyd\'s), merge sort on linked lists.', 'video', 2, false),
            mkLesson(c4._id, c4.modules[1]._id, 'Binary Trees & BST Operations', 'Traversals (inorder, preorder, postorder, level-order), BST insert/delete/search, balanced BST.', 'video', 1, false),
            mkLesson(c4._id, c4.modules[2]._id, 'Dynamic Programming Patterns', '0/1 Knapsack, LCS, LIS, coin change, matrix chain multiplication with memoization & tabulation.', 'video', 1, false),
        ]);

        // C5 Lessons (NEET Biology)
        const c5Lessons = await Lesson.insertMany([
            mkLesson(c5._id, c5.modules[0]._id, 'Cell Structure & Organelles — NCERT Deep Dive', 'Detailed analysis of cell membrane, nucleus, mitochondria, ER, Golgi body with diagram-based MCQs.', 'video', 1, true),
            mkLesson(c5._id, c5.modules[0]._id, 'Mendelian Genetics & Punnett Squares', 'Mono & dihybrid crosses, co-dominance, incomplete dominance, polygenic inheritance.', 'video', 2, false),
            mkLesson(c5._id, c5.modules[1]._id, 'Human Digestive System', 'Alimentary canal, digestive glands, enzymes, absorption, and disorders.', 'video', 1, false),
        ]);

        // C6 Lessons (Python DS/ML)
        const c6Lessons = await Lesson.insertMany([
            mkLesson(c6._id, c6.modules[0]._id, 'Python Basics — Variables, Loops & Functions', 'Data types, operators, control flow, functions, and list comprehensions.', 'video', 1, true),
            mkLesson(c6._id, c6.modules[1]._id, 'NumPy Arrays & Vectorization', 'Creating arrays, indexing, slicing, broadcasting, and mathematical operations.', 'video', 1, false),
            mkLesson(c6._id, c6.modules[1]._id, 'Pandas DataFrame Manipulation', 'Reading CSV/Excel, filtering, groupby, merge, pivot tables, and handling missing data.', 'video', 2, false),
            mkLesson(c6._id, c6.modules[2]._id, 'Linear Regression with Scikit-learn', 'Feature engineering, train/test split, model training, evaluation metrics (MSE, R²).', 'video', 1, false),
        ]);

        // C7 Lessons (UI/UX)
        const c7Lessons = await Lesson.insertMany([
            mkLesson(c7._id, c7.modules[0]._id, 'Empathy Mapping & User Personas', 'Learn to create detailed empathy maps and user personas to drive design decisions.', 'video', 1, true),
            mkLesson(c7._id, c7.modules[1]._id, 'Figma Auto-Layout & Components', 'Master auto-layout for responsive designs, create reusable components and variants.', 'video', 1, true),
        ]);

        // C8 Lessons (JEE Maths)
        const c8Lessons = await Lesson.insertMany([
            mkLesson(c8._id, c8.modules[0]._id, 'Limits & Continuity — 50 Solved Problems', 'L\'Hôpital\'s rule, squeeze theorem, continuity at a point, types of discontinuities.', 'video', 1, true),
            mkLesson(c8._id, c8.modules[0]._id, 'Application of Derivatives — Maxima/Minima', 'Rate of change, tangent/normal, increasing/decreasing functions, optimization problems.', 'video', 2, false),
            mkLesson(c8._id, c8.modules[1]._id, 'Definite Integrals & Area Under Curves', 'Properties of definite integrals, Walli\'s formula, area between curves.', 'video', 1, false),
        ]);

        const allLessons = [...c1Lessons, ...c2Lessons, ...c3Lessons, ...c4Lessons, ...c5Lessons, ...c6Lessons, ...c7Lessons, ...c8Lessons];

        // ══════════════════════════════════════════════════════════════════════
        //  12. BATCHES
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [12/40] Batches...');
        const apexStudentIds = [uStudents.aarav, uStudents.diya, uStudents.ishaan, uStudents.ananya, uStudents.tanvi].map(u => u._id);
        const zenithStudentIds = [uStudents.kabir, uStudents.nisha, uStudents.vivaan, uStudents.sanya].map(u => u._id);

        const b1 = await Batch.create({ name: 'JEE Physics 2026-A', courseId: c3._id, tutorId: tVikram._id, instructors: [tVikram._id], grade: 'A', instituteId: apexInstitute._id, students: apexStudentIds, scheduleDescription: 'Mon, Wed, Fri — 6:00 PM to 7:30 PM IST', status: 'active', startDate: ago(30), endDate: future(60), announcements: [{ title: 'Weekly Test Every Saturday', message: 'Mock test covering last week\'s topics. Mandatory for all students.', createdAt: ago(2) }] });
        const b2 = await Batch.create({ name: 'NEET Bio 2026-A', courseId: c5._id, tutorId: tSneha._id, instructors: [tSneha._id], grade: 'A', instituteId: apexInstitute._id, students: [uStudents.diya._id, uStudents.ananya._id, uStudents.tanvi._id], scheduleDescription: 'Tue, Thu, Sat — 4:00 PM to 5:30 PM IST', status: 'active', startDate: ago(25), endDate: future(55) });
        const b3 = await Batch.create({ name: 'MERN Cohort-7', courseId: c1._id, tutorId: tArjun._id, instructors: [tArjun._id], grade: 'A', instituteId: zenithInstitute._id, students: [...zenithStudentIds, uStudents.riya._id], scheduleDescription: 'Mon to Fri — 10:00 AM to 12:00 PM IST', status: 'active', startDate: ago(20), endDate: future(70) });
        const b4 = await Batch.create({ name: 'DSA Cohort-3', courseId: c4._id, tutorId: tKavita._id, instructors: [tKavita._id], grade: 'B', instituteId: zenithInstitute._id, students: [uStudents.kabir._id, uStudents.vivaan._id], scheduleDescription: 'Wed, Fri — 2:00 PM to 4:00 PM IST', status: 'active', startDate: ago(15), endDate: future(45) });

        // ══════════════════════════════════════════════════════════════════════
        //  13. ENROLLMENTS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [13/40] Enrollments...');
        const enrollmentPairs = [
            // C1 MERN — Zenith students + cross
            { s: 'kabir', c: c1, b: b3, d: 20, pct: 42, completed: [c1Lessons[0], c1Lessons[1], c1Lessons[2]] },
            { s: 'nisha', c: c1, b: b3, d: 20, pct: 28, completed: [c1Lessons[0], c1Lessons[1]] },
            { s: 'vivaan', c: c1, b: b3, d: 18, pct: 14, completed: [c1Lessons[0]] },
            { s: 'sanya', c: c1, b: b3, d: 15, pct: 14, completed: [c1Lessons[0]] },
            { s: 'riya', c: c1, b: b3, d: 10, pct: 0, completed: [] },
            { s: 'aditya', c: c1, b: null, d: 8, pct: 14, completed: [c1Lessons[0]] },
            // C2 React — Independent students
            { s: 'aditya', c: c2, b: null, d: 12, pct: 50, completed: [c2Lessons[0], c2Lessons[1]] },
            { s: 'pooja', c: c2, b: null, d: 7, pct: 25, completed: [c2Lessons[0]] },
            { s: 'kabir', c: c2, b: null, d: 5, pct: 0, completed: [] },
            // C3 JEE Physics — Apex students
            { s: 'aarav', c: c3, b: b1, d: 30, pct: 100, completed: [c3Lessons[0], c3Lessons[1], c3Lessons[2], c3Lessons[3]] },
            { s: 'diya', c: c3, b: b1, d: 28, pct: 50, completed: [c3Lessons[0], c3Lessons[1]] },
            { s: 'ishaan', c: c3, b: b1, d: 25, pct: 50, completed: [c3Lessons[0], c3Lessons[1]] },
            { s: 'ananya', c: c3, b: b1, d: 22, pct: 25, completed: [c3Lessons[0]] },
            { s: 'tanvi', c: c3, b: b1, d: 20, pct: 25, completed: [c3Lessons[0]] },
            // C4 DSA — Zenith students
            { s: 'kabir', c: c4, b: b4, d: 15, pct: 50, completed: [c4Lessons[0], c4Lessons[1]] },
            { s: 'vivaan', c: c4, b: b4, d: 12, pct: 25, completed: [c4Lessons[0]] },
            { s: 'nisha', c: c4, b: null, d: 10, pct: 0, completed: [] },
            { s: 'aryan', c: c4, b: null, d: 5, pct: 25, completed: [c4Lessons[0]] },
            // C5 NEET Bio — Apex students
            { s: 'diya', c: c5, b: b2, d: 25, pct: 66, completed: [c5Lessons[0], c5Lessons[1]] },
            { s: 'ananya', c: c5, b: b2, d: 22, pct: 33, completed: [c5Lessons[0]] },
            { s: 'tanvi', c: c5, b: b2, d: 18, pct: 33, completed: [c5Lessons[0]] },
            // C6 Python ML — Independent
            { s: 'pooja', c: c6, b: null, d: 14, pct: 50, completed: [c6Lessons[0], c6Lessons[1]] },
            { s: 'aryan', c: c6, b: null, d: 10, pct: 25, completed: [c6Lessons[0]] },
            { s: 'aditya', c: c6, b: null, d: 3, pct: 0, completed: [] },
            // C7 UI/UX (free) — Various
            { s: 'pooja', c: c7, b: null, d: 5, pct: 100, completed: [c7Lessons[0], c7Lessons[1]] },
            { s: 'sanya', c: c7, b: null, d: 3, pct: 50, completed: [c7Lessons[0]] },
            // C8 JEE Maths — Apex
            { s: 'aarav', c: c8, b: null, d: 20, pct: 66, completed: [c8Lessons[0], c8Lessons[1]] },
            { s: 'ishaan', c: c8, b: null, d: 15, pct: 33, completed: [c8Lessons[0]] },
            { s: 'diya', c: c8, b: null, d: 12, pct: 0, completed: [] },
        ];

        for (const e of enrollmentPairs) {
            await Enrollment.create({
                studentId: uStudents[e.s]._id, courseId: e.c._id, batchId: e.b?._id || undefined,
                enrolledAt: ago(e.d), status: e.pct === 100 ? 'completed' : 'active',
                progress: { completedLessons: e.completed.map(l => l._id), percentage: e.pct },
                lastAccessed: ago(Math.floor(Math.random() * 3)),
                ...(e.pct === 100 ? { completedAt: ago(1) } : {}),
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        //  14. PROGRESS (Partial video progress)
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [14/40] Progress (partial video tracking)...');
        const progressData = [
            // Aarav — 100% through C3
            { s: 'aarav', c: c3, l: c3Lessons[0], completed: true, timeSpent: 1400, lastPos: 1400 },
            { s: 'aarav', c: c3, l: c3Lessons[1], completed: true, timeSpent: 1200, lastPos: 1200 },
            { s: 'aarav', c: c3, l: c3Lessons[2], completed: true, timeSpent: 1100, lastPos: 1100 },
            { s: 'aarav', c: c3, l: c3Lessons[3], completed: true, timeSpent: 1200, lastPos: 1200 },
            // Kabir — 42% through C1
            { s: 'kabir', c: c1, l: c1Lessons[0], completed: true, timeSpent: 900, lastPos: 900 },
            { s: 'kabir', c: c1, l: c1Lessons[1], completed: true, timeSpent: 1100, lastPos: 1100 },
            { s: 'kabir', c: c1, l: c1Lessons[2], completed: true, timeSpent: 1000, lastPos: 1000 },
            { s: 'kabir', c: c1, l: c1Lessons[3], completed: false, timeSpent: 350, lastPos: 350 }, // ~25% through
            // Pooja — 100% through C7
            { s: 'pooja', c: c7, l: c7Lessons[0], completed: true, timeSpent: 960, lastPos: 960 },
            { s: 'pooja', c: c7, l: c7Lessons[1], completed: true, timeSpent: 1050, lastPos: 1050 },
            // Diya — 50% through C3
            { s: 'diya', c: c3, l: c3Lessons[0], completed: true, timeSpent: 1300, lastPos: 1300 },
            { s: 'diya', c: c3, l: c3Lessons[1], completed: true, timeSpent: 1150, lastPos: 1150 },
            { s: 'diya', c: c3, l: c3Lessons[2], completed: false, timeSpent: 820, lastPos: 820 }, // 72% through
        ];
        for (const p of progressData) {
            await Progress.create({
                studentId: uStudents[p.s]._id, courseId: p.c._id, lessonId: p.l._id,
                completed: p.completed, timeSpent: p.timeSpent, lastWatchedPosition: p.lastPos,
                ...(p.completed ? { completedAt: ago(Math.floor(Math.random() * 10) + 1) } : {}),
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        //  15. LIVE CLASSES
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [15/40] Live Classes...');
        const lc1 = await LiveClass.create({ title: 'JEE Physics — Rotational Mechanics Live Session', description: 'Live problem-solving session on rotational mechanics and moment of inertia.', tutorId: tVikram._id, courseId: c3._id, batchId: b1._id, instituteId: apexInstitute._id, visibility: 'institute', audience: { scope: 'batch', instituteId: apexInstitute._id, batchIds: [b1._id], studentIds: [] }, dateTime: ago(3, 18), duration: 90, meetingLink: 'https://zoom.us/j/1111111111', meetingId: '1111111111', passcode: 'apex123', platform: 'zoom', status: 'completed', recordingLink: SAMPLE_VIDEO });
        const lc2 = await LiveClass.create({ title: 'MERN Bootcamp — React Hooks Deep Dive', description: 'Interactive session on useState, useEffect, useRef, and custom hooks.', tutorId: tArjun._id, courseId: c1._id, batchId: b3._id, instituteId: zenithInstitute._id, visibility: 'institute', audience: { scope: 'batch', instituteId: zenithInstitute._id, batchIds: [b3._id], studentIds: [] }, dateTime: ago(1, 10), duration: 120, meetingLink: 'https://zoom.us/j/2222222222', meetingId: '2222222222', passcode: 'zenith456', platform: 'zoom', status: 'completed', recordingLink: SAMPLE_VIDEO });
        const lc3 = await LiveClass.create({ title: 'JEE Maths — Calculus Problem Solving Marathon', description: 'Solve 30 JEE-level calculus problems in 2 hours.', tutorId: tVikram._id, courseId: c8._id, instituteId: apexInstitute._id, visibility: 'institute', audience: { scope: 'institute', instituteId: apexInstitute._id, batchIds: [], studentIds: [] }, dateTime: future(2, 18), duration: 120, meetingLink: 'https://zoom.us/j/3333333333', meetingId: '3333333333', passcode: 'calc789', platform: 'zoom', status: 'scheduled' });

        // ══════════════════════════════════════════════════════════════════════
        //  16. ATTENDANCE (LiveClass)
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [16/40] LiveClass Attendance...');
        const attendanceData = [
            { lc: lc1, students: ['aarav', 'diya', 'ishaan', 'ananya'], c: c3, statuses: ['present', 'present', 'late', 'present'] },
            { lc: lc2, students: ['kabir', 'nisha', 'vivaan', 'sanya'], c: c1, statuses: ['present', 'present', 'present', 'late'] },
        ];
        for (const a of attendanceData) {
            for (let i = 0; i < a.students.length; i++) {
                await Attendance.create({ liveClassId: a.lc._id, studentId: uStudents[a.students[i]]._id, courseId: a.c._id, status: a.statuses[i], joinedAt: new Date(a.lc.dateTime.getTime() + (a.statuses[i] === 'late' ? 15 * 60000 : 0)) });
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        //  17. BATCH ATTENDANCE (Last 5 days)
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [17/40] Batch Attendance (5 days)...');
        for (let day = 1; day <= 5; day++) {
            const d = ago(day);
            d.setHours(0, 0, 0, 0);
            // Apex JEE batch
            await BatchAttendance.create({
                batchId: b1._id, tutorId: tVikram._id, date: d,
                records: apexStudentIds.map((sid, i) => ({
                    studentId: sid,
                    status: i === 2 && day === 3 ? 'absent' : (i === 4 && day === 1 ? 'late' : 'present'),
                    remarks: i === 2 && day === 3 ? 'Medical leave' : '',
                })),
            });
            // Zenith MERN batch
            await BatchAttendance.create({
                batchId: b3._id, tutorId: tArjun._id, date: new Date(d.getTime() + 86400000), // offset by 1 day to avoid unique index collision
                records: zenithStudentIds.map((sid, i) => ({
                    studentId: sid,
                    status: i === 1 && day === 2 ? 'absent' : 'present',
                })),
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        //  18. EXAMS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [18/40] Exams...');
        const exam1 = await Exam.create({
            courseId: c3._id, tutorId: tVikram._id, batchId: b1._id, instituteId: apexInstitute._id,
            audience: { scope: 'batch', instituteId: apexInstitute._id, batchIds: [b1._id], studentIds: [] },
            title: 'JEE Physics Mock Test — Mechanics', description: 'Full-length mock test covering Newton\'s laws, rotational mechanics, and gravitation.',
            type: 'assessment', instructions: 'Ensure your webcam is ON. Tab switching will be flagged.',
            duration: 60, passingMarks: 20, passingPercentage: 40,
            negativeMarking: true, isProctoringEnabled: true, isAudioProctoringEnabled: true, strictTabSwitching: true,
            shuffleQuestions: true, showResultImmediately: true, showCorrectAnswers: true, allowRetake: false, maxAttempts: 1,
            startDate: ago(5), endDate: future(5), isScheduled: true, status: 'published', isPublished: true,
            questions: [
                { question: 'A block of mass 5 kg is placed on a frictionless inclined plane of angle 30°. What is the acceleration of the block?', questionType: 'mcq', options: [{ text: '4.9 m/s²', isCorrect: true }, { text: '9.8 m/s²', isCorrect: false }, { text: '2.45 m/s²', isCorrect: false }, { text: '7.35 m/s²', isCorrect: false }], explanation: 'a = g·sin(30°) = 9.8 × 0.5 = 4.9 m/s²', points: 10, difficulty: 'easy', tags: ['mechanics', 'incline'] },
                { question: 'The moment of inertia of a solid disc about its diameter is (1/4)MR². What is it about a tangent parallel to the diameter?', questionType: 'mcq', options: [{ text: '(5/4)MR²', isCorrect: true }, { text: '(3/4)MR²', isCorrect: false }, { text: '(3/2)MR²', isCorrect: false }, { text: '2MR²', isCorrect: false }], explanation: 'By parallel axis theorem: I = I_cm + Md² = (1/4)MR² + MR² = (5/4)MR²', points: 10, difficulty: 'medium', tags: ['rotational'] },
                { question: 'What is the escape velocity from Earth\'s surface in km/s (approximately)?', questionType: 'numeric', numericAnswer: 11.2, tolerance: 0.3, explanation: 'v_e = √(2gR) ≈ 11.2 km/s', points: 10, difficulty: 'easy', tags: ['gravitation'] },
                { question: 'Match the physical quantity with its SI unit:', questionType: 'match_the_following', pairs: [{ left: 'Torque', right: 'N·m' }, { left: 'Angular momentum', right: 'kg·m²/s' }, { left: 'Moment of inertia', right: 'kg·m²' }], explanation: 'Standard SI units for rotational quantities.', points: 10, difficulty: 'easy', tags: ['units'] },
            ],
        });

        const exam2 = await Exam.create({
            courseId: c1._id, tutorId: tArjun._id, batchId: b3._id, instituteId: zenithInstitute._id,
            audience: { scope: 'batch', instituteId: zenithInstitute._id, batchIds: [b3._id], studentIds: [] },
            title: 'MERN Bootcamp — Backend Assessment', description: 'Test your Node.js, Express, and MongoDB knowledge.',
            type: 'assessment', instructions: 'Open-book assessment. You may refer to documentation but no tab switching beyond docs.',
            duration: 45, passingMarks: 12, passingPercentage: 40,
            isProctoringEnabled: true, isAudioProctoringEnabled: false, strictTabSwitching: false,
            showResultImmediately: true, showCorrectAnswers: true, allowRetake: true, maxAttempts: 2,
            startDate: ago(3), endDate: future(7), isScheduled: true, status: 'published', isPublished: true,
            questions: [
                { question: 'What does the Express middleware next() function do?', questionType: 'mcq', options: [{ text: 'Sends response to client', isCorrect: false }, { text: 'Passes control to the next middleware', isCorrect: true }, { text: 'Terminates the request', isCorrect: false }, { text: 'Logs the request', isCorrect: false }], explanation: 'next() passes control to the next middleware function in the stack.', points: 10, difficulty: 'easy', tags: ['express'] },
                { question: 'In MongoDB, which aggregation stage filters documents?', questionType: 'mcq', options: [{ text: '$project', isCorrect: false }, { text: '$match', isCorrect: true }, { text: '$group', isCorrect: false }, { text: '$sort', isCorrect: false }], explanation: '$match filters documents by condition, similar to find().', points: 10, difficulty: 'easy', tags: ['mongodb'] },
                { question: 'What is the default port number for MongoDB?', questionType: 'numeric', numericAnswer: 27017, tolerance: 0, explanation: 'MongoDB default port is 27017.', points: 10, difficulty: 'easy', tags: ['mongodb'] },
            ],
        });

        const exam3 = await Exam.create({
            courseId: c8._id, tutorId: tVikram._id, instituteId: apexInstitute._id,
            audience: { scope: 'institute', instituteId: apexInstitute._id, batchIds: [], studentIds: [] },
            title: 'JEE Maths — Limits & Derivatives Practice', description: 'Practice set focusing on limits, continuity, differentiability, and L\'Hopital\'s rule.',
            type: 'practice', instructions: 'Attempt all questions. Correct answers have detailed solutions.',
            duration: 30, passingMarks: 10, passingPercentage: 50,
            isProctoringEnabled: false, isAudioProctoringEnabled: false, strictTabSwitching: false,
            showResultImmediately: true, showCorrectAnswers: true, allowRetake: true, maxAttempts: 5,
            startDate: ago(4), endDate: future(10), isScheduled: true, status: 'published', isPublished: true,
            questions: [
                { question: 'What is the limit of (sin x)/x as x approaches 0?', questionType: 'numeric', numericAnswer: 1, tolerance: 0, explanation: 'Standard limit result.', points: 10, difficulty: 'easy', tags: ['limits', 'calculus'] },
                { question: 'If f(x) = x², find the derivative f\'(3).', questionType: 'numeric', numericAnswer: 6, tolerance: 0, explanation: 'f\'(x) = 2x, so f\'(3) = 6.', points: 10, difficulty: 'easy', tags: ['derivative'] },
            ],
        });

        const exam4 = await Exam.create({
            courseId: c5._id, tutorId: tSneha._id, batchId: b2._id, instituteId: apexInstitute._id,
            audience: { scope: 'batch', instituteId: apexInstitute._id, batchIds: [b2._id], studentIds: [] },
            title: 'NEET Biology — Genetics Unit Test', description: 'Unit test covering cell division, Mendelian inheritance, and molecular basis of genetics.',
            type: 'assessment', instructions: 'Webcam monitoring is enabled. No external calculators needed.',
            duration: 45, passingMarks: 15, passingPercentage: 50,
            isProctoringEnabled: true, isAudioProctoringEnabled: false, strictTabSwitching: true,
            showResultImmediately: true, showCorrectAnswers: true, allowRetake: false, maxAttempts: 1,
            startDate: ago(2), endDate: future(3), isScheduled: true, status: 'published', isPublished: true,
            questions: [
                { question: 'Which of the following is considered the powerhouse of the cell?', questionType: 'mcq', options: [{ text: 'Mitochondria', isCorrect: true }, { text: 'Nucleus', isCorrect: false }, { text: 'Ribosome', isCorrect: false }, { text: 'Golgi Apparatus', isCorrect: false }], explanation: 'Mitochondria generate most of the cell\'s supply of adenosine triphosphate (ATP).', points: 10, difficulty: 'easy', tags: ['cell'] },
                { question: 'What is the phenotypic ratio of a dihybrid cross in Mendel\'s experiments?', questionType: 'mcq', options: [{ text: '9:3:3:1', isCorrect: true }, { text: '3:1', isCorrect: false }, { text: '1:2:1', isCorrect: false }, { text: '9:7', isCorrect: false }], explanation: 'The classic dihybrid ratio is 9:3:3:1.', points: 10, difficulty: 'medium', tags: ['genetics'] },
            ],
        });

        const exam5 = await Exam.create({
            courseId: c4._id, tutorId: tKavita._id, batchId: b4._id, instituteId: zenithInstitute._id,
            audience: { scope: 'batch', instituteId: zenithInstitute._id, batchIds: [b4._id], studentIds: [] },
            title: 'DSA — Trees & Graphs Midterm', description: 'Assesses tree traversals, BST properties, DFS/BFS implementations, and cycle detection.',
            type: 'midterm', instructions: 'Strict proctoring active. Answer all questions within time limit.',
            duration: 50, passingMarks: 12, passingPercentage: 40,
            isProctoringEnabled: true, isAudioProctoringEnabled: true, strictTabSwitching: true,
            showResultImmediately: false, showCorrectAnswers: false, allowRetake: false, maxAttempts: 1,
            startDate: ago(1), endDate: future(4), isScheduled: true, status: 'published', isPublished: true,
            questions: [
                { question: 'What is the worst-case time complexity of searching in a Binary Search Tree (BST)?', questionType: 'mcq', options: [{ text: 'O(N)', isCorrect: true }, { text: 'O(log N)', isCorrect: false }, { text: 'O(1)', isCorrect: false }, { text: 'O(N log N)', isCorrect: false }], explanation: 'In a skewed BST, search takes O(N) time.', points: 15, difficulty: 'medium', tags: ['bst', 'complexity'] },
                { question: 'Which algorithm is used to find the shortest path in a weighted graph with non-negative edge weights?', questionType: 'mcq', options: [{ text: 'Dijkstra\'s algorithm', isCorrect: true }, { text: 'Prim\'s algorithm', isCorrect: false }, { text: 'Kruskal\'s algorithm', isCorrect: false }, { text: 'Bellman-Ford algorithm', isCorrect: false }], explanation: 'Dijkstra\'s algorithm finds shortest paths from single source with non-negative weights.', points: 15, difficulty: 'easy', tags: ['graphs', 'shortest-path'] },
            ],
        });

        const exam6 = await Exam.create({
            courseId: c2._id, tutorId: tRohanV._id,
            audience: { scope: 'global', instituteId: null, batchIds: [], studentIds: [] },
            title: 'React Performance Optimization Assessment', description: 'Covers React.memo, useMemo, useCallback, virtualization, and lazy loading.',
            type: 'assessment', instructions: 'Open exam. Test your React performance optimization concepts.',
            duration: 20, passingMarks: 5, passingPercentage: 50,
            isProctoringEnabled: false, isAudioProctoringEnabled: false, strictTabSwitching: false,
            showResultImmediately: true, showCorrectAnswers: true, allowRetake: true, maxAttempts: 3,
            startDate: ago(3), endDate: future(15), isScheduled: true, status: 'published', isPublished: true,
            questions: [
                { question: 'Which hook should be used to memoize a computed value between re-renders?', questionType: 'mcq', options: [{ text: 'useMemo', isCorrect: true }, { text: 'useCallback', isCorrect: false }, { text: 'useEffect', isCorrect: false }, { text: 'useRef', isCorrect: false }], explanation: 'useMemo memoizes values, whereas useCallback memoizes callbacks.', points: 10, difficulty: 'easy', tags: ['react', 'performance'] },
            ],
        });

        const exam7 = await Exam.create({
            courseId: c3._id, tutorId: tVikram._id, batchId: b1._id, instituteId: apexInstitute._id,
            audience: { scope: 'batch', instituteId: apexInstitute._id, batchIds: [b1._id], studentIds: [] },
            title: 'JEE Physics Chapter Test — Electromagnetism', description: 'Covers electric fields, Gauss\'s law, capacitance, and magnetic force equations.',
            type: 'assessment', instructions: 'Formula sheets are not allowed. Scientific calculator is permitted.',
            duration: 40, passingMarks: 10, passingPercentage: 50,
            isProctoringEnabled: true, isAudioProctoringEnabled: false, strictTabSwitching: true,
            showResultImmediately: true, showCorrectAnswers: true, allowRetake: false, maxAttempts: 1,
            startDate: future(2), endDate: future(7), isScheduled: true, status: 'published', isPublished: true,
            questions: [
                { question: 'What is the capacitance of a parallel plate capacitor of area A and plate separation d in vacuum?', questionType: 'mcq', options: [{ text: 'ε₀A/d', isCorrect: true }, { text: 'ε₀d/A', isCorrect: false }, { text: 'A/(ε₀d)', isCorrect: false }, { text: 'd/(ε₀A)', isCorrect: false }], explanation: 'C = ε₀A/d by Gauss\'s law derivation.', points: 10, difficulty: 'easy', tags: ['capacitance', 'physics'] },
            ],
        });

        const exam8 = await Exam.create({
            courseId: c3._id, tutorId: tVikram._id, instituteId: apexInstitute._id,
            audience: { scope: 'institute', instituteId: apexInstitute._id, batchIds: [], studentIds: [] },
            title: 'JEE Physics Practice Set — Thermodynamics', description: 'Practice thermodynamics cycles, ideal gas equations, and heat engine efficiency.',
            type: 'practice', instructions: 'Optional practice. Free retakes enabled.',
            duration: 30, passingMarks: 8, passingPercentage: 40,
            isProctoringEnabled: false, isAudioProctoringEnabled: false, strictTabSwitching: false,
            showResultImmediately: true, showCorrectAnswers: true, allowRetake: true, maxAttempts: 10,
            startDate: ago(10), endDate: future(20), isScheduled: true, status: 'published', isPublished: true,
            questions: [
                { question: 'In an adiabatic process, what is the relation between pressure and volume?', questionType: 'mcq', options: [{ text: 'PV^γ = constant', isCorrect: true }, { text: 'PV = constant', isCorrect: false }, { text: 'P/V = constant', isCorrect: false }, { text: 'P^γV = constant', isCorrect: false }], explanation: 'For adiabatic processes, PV^γ = constant where γ is the ratio of specific heats.', points: 10, difficulty: 'medium', tags: ['thermodynamics'] },
            ],
        });

        const exam9 = await Exam.create({
            courseId: c8._id, tutorId: tVikram._id, instituteId: apexInstitute._id,
            audience: { scope: 'institute', instituteId: apexInstitute._id, batchIds: [], studentIds: [] },
            title: 'JEE Maths Mock Test — Integration & Area', description: 'Mock test covering definite integration, integration by parts, and area bounded by curves.',
            type: 'assessment', instructions: 'No calculators allowed. Strictly timed.',
            duration: 45, passingMarks: 15, passingPercentage: 50,
            isProctoringEnabled: true, isAudioProctoringEnabled: true, strictTabSwitching: true,
            showResultImmediately: false, showCorrectAnswers: false, allowRetake: false, maxAttempts: 1,
            startDate: future(1), endDate: future(6), isScheduled: true, status: 'published', isPublished: true,
            questions: [
                { question: 'Evaluate the definite integral of x from 0 to 2.', questionType: 'numeric', numericAnswer: 2, tolerance: 0, explanation: '∫x dx = [x²/2] from 0 to 2 = 4/2 - 0 = 2.', points: 10, difficulty: 'easy', tags: ['integration'] },
            ],
        });

        const exam10 = await Exam.create({
            courseId: c8._id, tutorId: tVikram._id,
            audience: { scope: 'global', instituteId: null, batchIds: [], studentIds: [] },
            title: 'JEE Maths Practice Set — Quadratic Equations', description: 'Practice roots of equations, discriminant properties, and graphing quadratic functions.',
            type: 'practice', instructions: 'Solve and review explanations.',
            duration: 25, passingMarks: 10, passingPercentage: 50,
            isProctoringEnabled: false, isAudioProctoringEnabled: false, strictTabSwitching: false,
            showResultImmediately: true, showCorrectAnswers: true, allowRetake: true, maxAttempts: 5,
            startDate: ago(8), endDate: future(14), isScheduled: true, status: 'published', isPublished: true,
            questions: [
                { question: 'What is the sum of roots for the equation ax² + bx + c = 0?', questionType: 'mcq', options: [{ text: '-b/a', isCorrect: true }, { text: 'b/a', isCorrect: false }, { text: 'c/a', isCorrect: false }, { text: '-c/a', isCorrect: false }], explanation: 'By Vieta\'s formulas, sum of roots is -b/a.', points: 10, difficulty: 'easy', tags: ['quadratic'] },
            ],
        });

        // ══════════════════════════════════════════════════════════════════════
        //  19. EXAM ATTEMPTS (with AI proctoring)
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [19/40] Exam Attempts (AI proctoring edge cases)...');
        // Aarav — Suspicious Detected
        await ExamAttempt.create({
            examId: exam1._id, studentId: uStudents.aarav._id, courseId: c3._id, attemptNumber: 1,
            score: 30, percentage: 75, isPassed: true, timeSpent: 2400, percentile: 88,
            startedAt: ago(2, 0, 60), submittedAt: ago(2),
            tabSwitchCount: 5, tabSwitchLog: [{ switchedAt: ago(2, 0, 50), count: 1 }, { switchedAt: ago(2, 0, 40), count: 1 }, { switchedAt: ago(2, 0, 25), count: 1 }],
            proctoringEvents: [
                { eventType: 'tab_switch', severity: 'medium', details: 'Switched to Chrome browser tab', timestamp: ago(2, 0, 50) },
                { eventType: 'multiple_faces', severity: 'high', details: '2 faces detected in webcam frame', timestamp: ago(2, 0, 35) },
                { eventType: 'no_face', severity: 'medium', details: 'Face not visible for 8 seconds', timestamp: ago(2, 0, 20) },
                { eventType: 'audio_anomaly', severity: 'low', details: 'Background speech pattern detected', timestamp: ago(2, 0, 10) },
            ],
            aiRiskScore: 7, aiRiskLevel: 'Suspicious Detected',
            aiProctoringSummary: 'Multiple anomalies detected: 5 tab switches, 2 faces visible at timestamp 35:00, face absence at 40:00. Background voice detected. High risk of external assistance.',
            answers: [
                { questionId: exam1.questions[0]._id, selectedOption: 0, selectedOptionText: '4.9 m/s²', isCorrect: true, pointsEarned: 10, questionData: { question: exam1.questions[0].question, options: exam1.questions[0].options, correctOption: 0, explanation: exam1.questions[0].explanation, points: 10, difficulty: 'easy', questionType: 'mcq' } },
                { questionId: exam1.questions[1]._id, selectedOption: 0, selectedOptionText: '(5/4)MR²', isCorrect: true, pointsEarned: 10, questionData: { question: exam1.questions[1].question, options: exam1.questions[1].options, correctOption: 0, explanation: exam1.questions[1].explanation, points: 10, difficulty: 'medium', questionType: 'mcq' } },
                { questionId: exam1.questions[2]._id, numericAnswer: 11.2, isCorrect: true, pointsEarned: 10, questionData: { question: exam1.questions[2].question, options: [], correctOption: null, explanation: exam1.questions[2].explanation, points: 10, difficulty: 'easy', questionType: 'numeric', numericAnswer: 11.2, tolerance: 0.3 } },
            ],
        });
        // Diya — Low Confidence
        await ExamAttempt.create({
            examId: exam1._id, studentId: uStudents.diya._id, courseId: c3._id, attemptNumber: 1,
            score: 20, percentage: 50, isPassed: true, timeSpent: 3200, percentile: 60,
            startedAt: ago(2, 0, 60), submittedAt: ago(2, 0, 7),
            tabSwitchCount: 1, tabSwitchLog: [{ switchedAt: ago(2, 0, 30), count: 1 }],
            proctoringEvents: [{ eventType: 'tab_switch', severity: 'low', details: 'Single tab switch — possibly accidental', timestamp: ago(2, 0, 30) }],
            aiRiskScore: 3, aiRiskLevel: 'Low Confidence Detected',
            aiProctoringSummary: 'Single tab switch detected. Consistent face presence otherwise. Low risk — likely accidental.',
            answers: [
                { questionId: exam1.questions[0]._id, selectedOption: 0, selectedOptionText: '4.9 m/s²', isCorrect: true, pointsEarned: 10, questionData: { question: exam1.questions[0].question, options: exam1.questions[0].options, correctOption: 0, points: 10, difficulty: 'easy', questionType: 'mcq' } },
                { questionId: exam1.questions[1]._id, selectedOption: 1, selectedOptionText: '(3/4)MR²', isCorrect: false, pointsEarned: 0, questionData: { question: exam1.questions[1].question, options: exam1.questions[1].options, correctOption: 0, points: 10, difficulty: 'medium', questionType: 'mcq' } },
                { questionId: exam1.questions[2]._id, numericAnswer: 11, isCorrect: true, pointsEarned: 10, questionData: { question: exam1.questions[2].question, options: [], correctOption: null, points: 10, difficulty: 'easy', questionType: 'numeric', numericAnswer: 11.2, tolerance: 0.3 } },
            ],
        });
        // Ishaan — Safe
        await ExamAttempt.create({
            examId: exam1._id, studentId: uStudents.ishaan._id, courseId: c3._id, attemptNumber: 1,
            score: 10, percentage: 25, isPassed: false, timeSpent: 3500, percentile: 30,
            startedAt: ago(2, 0, 60), submittedAt: ago(2, 0, 2),
            tabSwitchCount: 0, proctoringEvents: [],
            aiRiskScore: 0, aiRiskLevel: 'Safe', aiProctoringSummary: 'Clean exam. Stable webcam feed, zero tab switches.',
            answers: [
                { questionId: exam1.questions[0]._id, selectedOption: 0, selectedOptionText: '4.9 m/s²', isCorrect: true, pointsEarned: 10, questionData: { question: exam1.questions[0].question, options: exam1.questions[0].options, correctOption: 0, points: 10, difficulty: 'easy', questionType: 'mcq' } },
                { questionId: exam1.questions[1]._id, selectedOption: 2, selectedOptionText: '(3/2)MR²', isCorrect: false, pointsEarned: 0, questionData: { question: exam1.questions[1].question, options: exam1.questions[1].options, correctOption: 0, points: 10, difficulty: 'medium', questionType: 'mcq' } },
            ],
        });
        // Kabir — MERN exam, Safe
        await ExamAttempt.create({
            examId: exam2._id, studentId: uStudents.kabir._id, courseId: c1._id, attemptNumber: 1,
            score: 30, percentage: 100, isPassed: true, timeSpent: 1800, percentile: 95,
            startedAt: ago(1, 0, 45), submittedAt: ago(1),
            tabSwitchCount: 0, proctoringEvents: [],
            aiRiskScore: 0, aiRiskLevel: 'Safe', aiProctoringSummary: 'Perfect exam — no anomalies.',
            answers: exam2.questions.map((q, i) => ({ questionId: q._id, selectedOption: i === 2 ? undefined : 1, numericAnswer: i === 2 ? 27017 : undefined, selectedOptionText: i < 2 ? q.options[1].text : undefined, isCorrect: true, pointsEarned: 10, questionData: { question: q.question, options: q.options || [], correctOption: 1, points: 10, difficulty: q.difficulty, questionType: q.questionType, numericAnswer: q.numericAnswer, tolerance: q.tolerance } })),
        });

        await Exam.findByIdAndUpdate(exam1._id, { attemptCount: 3, averageScore: 20 });
        await Exam.findByIdAndUpdate(exam2._id, { attemptCount: 1, averageScore: 30 });

        // ══════════════════════════════════════════════════════════════════════
        //  20. ASSIGNMENTS & SUBMISSIONS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [20/40] Assignments & Submissions...');
        const asn1 = await Assignment.create({
            instituteId: apexInstitute._id, courseId: c3._id, batchId: b1._id,
            audience: { scope: 'batch', instituteId: apexInstitute._id, batchIds: [b1._id], studentIds: [] },
            moduleId: c3.modules[0]._id, title: 'Numerical Problem Set — Newton\'s Laws',
            description: 'Solve 20 numerical problems on Newton\'s laws of motion. Show complete solutions with free-body diagrams.',
            dueDate: future(7), totalMarks: 100,
            rubric: [{ criterion: 'Free Body Diagrams', description: 'Clear and accurate FBDs for each problem.', points: 30 }, { criterion: 'Numerical Accuracy', description: 'Correct final answers with proper units.', points: 50 }, { criterion: 'Problem Approach', description: 'Logical step-by-step approach shown.', points: 20 }],
            status: 'published',
        });

        const asn2 = await Assignment.create({
            instituteId: zenithInstitute._id, courseId: c1._id, batchId: b3._id,
            audience: { scope: 'batch', instituteId: zenithInstitute._id, batchIds: [b3._id], studentIds: [] },
            moduleId: c1.modules[1]._id, title: 'Build a REST API with JWT Authentication',
            description: 'Create a complete Express.js REST API with user registration, login, JWT token generation, and protected routes. Include role-based access control.',
            dueDate: future(10), totalMarks: 100,
            rubric: [{ criterion: 'API Design', description: 'RESTful endpoints, proper HTTP methods and status codes.', points: 30 }, { criterion: 'Authentication', description: 'JWT implementation with refresh tokens.', points: 40 }, { criterion: 'Code Quality', description: 'Clean code, proper error handling, documentation.', points: 30 }],
            status: 'published',
        });

        await Submission.create({
            instituteId: apexInstitute._id, assignmentId: asn1._id, studentId: uStudents.aarav._id, courseId: c3._id,
            content: 'Solved all 20 problems. Used component method for inclined plane problems and energy conservation for elastic collision questions.',
            status: 'graded', grade: 92, feedback: 'Excellent work! FBDs are very clear. Minor error in Q14 — check the direction of friction.',
            rubricScores: [{ criterionId: asn1.rubric[0]._id, points: 28, comments: 'Very clear diagrams.' }, { criterionId: asn1.rubric[1]._id, points: 46, comments: 'One minor calculation error in Q14.' }, { criterionId: asn1.rubric[2]._id, points: 18, comments: 'Good logical flow.' }],
            submittedAt: ago(3), gradedAt: ago(1), gradedBy: uTutorVikram._id,
        });
        await Submission.create({
            instituteId: zenithInstitute._id, assignmentId: asn2._id, studentId: uStudents.kabir._id, courseId: c1._id,
            content: 'Built a complete auth API with bcrypt password hashing, JWT access + refresh tokens, and admin/user role middleware.',
            attachments: [{ name: 'auth-api-kabir.zip', url: 'https://zenithtech.io/submissions/kabir-auth-api.zip', type: 'zip' }],
            status: 'graded', grade: 88, feedback: 'Great implementation! Consider adding rate limiting for login endpoint.',
            submittedAt: ago(2), gradedAt: ago(0, 12), gradedBy: uTutorArjun._id,
        });
        await Submission.create({
            instituteId: zenithInstitute._id, assignmentId: asn2._id, studentId: uStudents.nisha._id, courseId: c1._id,
            content: 'Completed the assignment. Used jsonwebtoken for token generation and bcryptjs for hashing.',
            status: 'submitted', submittedAt: ago(1),
        });

        // ══════════════════════════════════════════════════════════════════════
        //  21. REVIEWS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [21/40] Reviews...');
        const reviewsData = [
            { c: c3, s: 'aarav', r: 5, t: 'Vikram sir\'s teaching style is extraordinary! The numerical shortcuts for rotational mechanics saved me 5 minutes per problem in my mock tests.' },
            { c: c3, s: 'diya', r: 5, t: 'Best JEE Physics course I\'ve ever taken. The wave optics section was explained so clearly that I got 100% in that topic in my school exam.' },
            { c: c3, s: 'ishaan', r: 4, t: 'Great course overall. Would love more solved examples for electromagnetic induction. The mechanics part was outstanding.' },
            { c: c1, s: 'kabir', r: 5, t: 'Arjun sir is an amazing instructor! The way he explained middleware and JWT auth made everything click. Built my first full-stack app in just 3 weeks.' },
            { c: c1, s: 'nisha', r: 4, t: 'Comprehensive bootcamp with real-world projects. The MongoDB aggregation pipeline section could use a few more examples though.' },
            { c: c1, s: 'vivaan', r: 5, t: 'Loved every minute of this bootcamp. The React hooks deep dive lesson was a game-changer for understanding state management.' },
            { c: c1, s: 'sanya', r: 4, t: 'Very well structured course. I went from knowing basic HTML to building a complete social media dashboard. Impressive curriculum!' },
            { c: c2, s: 'aditya', r: 5, t: 'Rohan sir\'s compound component pattern explanation was mind-blowing. I\'ve already refactored 3 of my existing projects using these patterns.' },
            { c: c2, s: 'pooja', r: 4, t: 'Great advanced course. The performance optimization section with React Profiler was incredibly practical.' },
            { c: c4, s: 'kabir', r: 4, t: 'Kavita ma\'am explains DP problems so well! The pattern-based approach to LeetCode problems is exactly what I needed for placements.' },
            { c: c4, s: 'vivaan', r: 5, t: 'Best DSA course for Java developers. The binary tree visualization techniques really helped me understand tree traversals.' },
            { c: c5, s: 'diya', r: 5, t: 'Sneha ma\'am\'s NCERT line-by-line analysis is pure gold! I scored 330/360 in my NEET Biology mock test after completing this course.' },
            { c: c5, s: 'ananya', r: 4, t: 'Very thorough coverage of NEET Biology syllabus. The diagram-based MCQ practice was especially helpful.' },
            { c: c6, s: 'pooja', r: 5, t: 'Meera ma\'am made machine learning so accessible! I built my first ML model predicting house prices after just 2 weeks.' },
            { c: c7, s: 'pooja', r: 5, t: 'Amazing free course on design thinking! The Figma auto-layout section alone is worth more than most paid courses.' },
            { c: c8, s: 'aarav', r: 5, t: 'Vikram sir\'s calculus shortcuts are legendary. I can now solve definite integral problems in under 90 seconds!' },
            { c: c8, s: 'ishaan', r: 4, t: 'Solid course for JEE Maths preparation. The limits & continuity chapter was very well explained with plenty of examples.' },
        ];
        for (const rv of reviewsData) {
            const review = await Review.create({ courseId: rv.c._id, studentId: uStudents[rv.s]._id, rating: rv.r, comment: rv.t });
            await review.updateRatings();
        }

        // ══════════════════════════════════════════════════════════════════════
        //  22. PAYMENTS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [22/40] Payments...');
        const paymentData = [
            // Institute subscriptions
            { sid: uApexAdmin._id, instId: apexInstitute._id, type: 'subscription_renewal', title: 'Apex Academy — Enterprise Plan Renewal', amount: 9999, status: 'paid', d: 30, settled: false, pf: 0 },
            { sid: uZenithAdmin._id, instId: zenithInstitute._id, type: 'subscription_renewal', title: 'Zenith Tech Space — Pro Plan Renewal', amount: 2999, status: 'paid', d: 15, settled: false, pf: 0 },
            // Course purchases
            { sid: uStudents.aarav._id, cid: c3._id, instId: apexInstitute._id, type: 'course_purchase', title: `Enrollment: ${c3.title}`, amount: 3499, status: 'paid', d: 30, settled: true, pf: 349.9, ie: 3149.1, stlAt: 20, pRef: 'pout_ref_APX001' },
            { sid: uStudents.diya._id, cid: c3._id, instId: apexInstitute._id, type: 'course_purchase', title: `Enrollment: ${c3.title}`, amount: 3499, status: 'paid', d: 28, settled: true, pf: 349.9, ie: 3149.1, stlAt: 18, pRef: 'pout_ref_APX002' },
            { sid: uStudents.kabir._id, cid: c1._id, instId: zenithInstitute._id, type: 'course_purchase', title: `Enrollment: ${c1.title}`, amount: 4999, status: 'paid', d: 20, settled: true, pf: 499.9, ie: 4499.1, stlAt: 10, pRef: 'pout_ref_ZNT001' },
            { sid: uStudents.nisha._id, cid: c1._id, instId: zenithInstitute._id, type: 'course_purchase', title: `Enrollment: ${c1.title}`, amount: 4999, status: 'paid', d: 20, settled: false, pf: 499.9, ie: 4499.1 },
            { sid: uStudents.aditya._id, cid: c2._id, type: 'course_purchase', title: `Enrollment: ${c2.title}`, amount: 1999, status: 'paid', d: 12, settled: false, pf: 199.9, ie: 0 },
            { sid: uStudents.pooja._id, cid: c6._id, type: 'course_purchase', title: `Enrollment: ${c6.title}`, amount: 2499, status: 'paid', d: 14, settled: false, pf: 249.9, ie: 0 },
            // Failed payment
            { sid: uStudents.aryan._id, cid: c4._id, instId: zenithInstitute._id, type: 'course_purchase', title: `Enrollment: ${c4.title} (Failed)`, amount: 2999, status: 'failed', d: 6, settled: false, pf: 0 },
            // Institute fee
            { sid: uStudents.aarav._id, instId: apexInstitute._id, type: 'institute_fee', title: 'Apex Academy — Quarterly Tuition Fee Q2 2026', amount: 15000, status: 'paid', d: 45, settled: true, pf: 1500, ie: 13500, stlAt: 35, pRef: 'pout_ref_FEE001' },
            { sid: uStudents.kabir._id, instId: zenithInstitute._id, type: 'institute_fee', title: 'Zenith Tech Space — Monthly Fee June 2026', amount: 8000, status: 'created', d: 2, settled: false, pf: 0, dueDate: future(5) },
        ];
        let payIdx = 1000;
        for (const p of paymentData) {
            payIdx++;
            await Payment.create({
                studentId: p.sid, courseId: p.cid || undefined, instituteId: p.instId || undefined,
                type: p.type, title: p.title, amount: p.amount, currency: 'INR',
                razorpayOrderId: `order_Sap2026${String(payIdx).padStart(6, '0')}`,
                razorpayPaymentId: p.status === 'paid' ? `pay_Sap2026${String(payIdx).padStart(6, '0')}` : null,
                razorpaySignature: p.status === 'paid' ? `sig_Sap2026${String(payIdx).padStart(6, '0')}` : null,
                status: p.status, paidAt: p.status === 'paid' ? ago(p.d) : null,
                dueDate: p.dueDate || (p.status === 'created' ? future(5) : null),
                platformFee: p.pf || 0, instituteEarnings: p.ie || 0,
                isSettled: p.settled || false, settledAt: p.stlAt ? ago(p.stlAt) : null,
                payoutReferenceId: p.pRef || null,
                invoiceNumber: p.status === 'paid' ? `INV-202606-${payIdx}` : undefined,
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        //  23. PAYOUT REQUESTS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [23/40] Payout Requests...');
        await PayoutRequest.create({ tutorId: tRohanV._id, amount: 15000, status: 'paid', bankDetails: { accountHolderName: 'Rohan Verma', accountNumber: 'XXXX-XXXX-4521', bankName: 'HDFC Bank', ifscCode: 'HDFC0001234', upiId: 'rohan@upi' }, processedDate: ago(5), adminNotes: 'Processed via RazorpayX.', transactionId: 'txn_rpx_rv_001' });
        await PayoutRequest.create({ tutorId: tMeera._id, amount: 8500, status: 'pending', bankDetails: { accountHolderName: 'Meera Joshi', accountNumber: 'XXXX-XXXX-7890', bankName: 'ICICI Bank', ifscCode: 'ICIC0001234', upiId: 'meera@upi' }, adminNotes: 'Pending approval — monthly settlement cycle.' });

        // ══════════════════════════════════════════════════════════════════════
        //  24. LEAVE REQUESTS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [24/40] Leave Requests...');
        await Leave.insertMany([
            { userId: uStudents.aarav._id, role: 'student', startDate: ago(10), endDate: ago(8), reason: 'Family function — cousin\'s wedding in Ahmedabad.', status: 'approved', adminComment: 'Approved. Please collect notes from classmates.' },
            { userId: uStudents.diya._id, role: 'student', startDate: future(3), endDate: future(5), reason: 'Not feeling well, have doctor\'s appointment scheduled.', status: 'pending' },
            { userId: uTutorSneha._id, role: 'tutor', startDate: ago(7), endDate: ago(5), reason: 'Medical conference at AIIMS — presenting research paper.', status: 'approved', adminComment: 'Approved. Dr. Vikram will cover Biology doubts.', substituteId: tVikram._id },
            { userId: uStudents.kabir._id, role: 'student', startDate: ago(5), endDate: ago(4), reason: 'Personal emergency.', status: 'rejected', adminComment: 'Rejected — exam week. Please attend online if possible.' },
        ]);

        // ══════════════════════════════════════════════════════════════════════
        //  25. CERTIFICATES
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [25/40] Certificates...');
        await Certificate.create({ certificateId: 'CERT-SAP-2026-0001', studentId: uStudents.pooja._id, courseId: c7._id, tutorId: uTutorRohan._id, issuedAt: ago(1), qrCodeData: 'https://sapience.io/verify/CERT-SAP-2026-0001' });
        await Certificate.create({ certificateId: 'CERT-SAP-2026-0002', studentId: uStudents.aarav._id, courseId: c3._id, tutorId: uTutorVikram._id, issuedAt: ago(1), qrCodeData: 'https://sapience.io/verify/CERT-SAP-2026-0002' });

        // ══════════════════════════════════════════════════════════════════════
        //  26. NOTIFICATIONS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [26/40] Notifications...');
        const notifData = [
            { userId: uStudents.aarav._id, type: 'course_enrolled', title: '🎉 Enrolled!', message: `You've been enrolled in "${c3.title}".`, data: { courseId: c3._id } },
            { userId: uStudents.aarav._id, type: 'assignment_graded', title: '📝 Assignment Graded', message: `Your assignment "Numerical Problem Set — Newton\'s Laws" scored 92/100.`, data: { courseId: c3._id }, isRead: true, readAt: ago(0, 5) },
            { userId: uStudents.kabir._id, type: 'course_enrolled', title: '🎉 Welcome to MERN Bootcamp!', message: `You've been enrolled in "${c1.title}".`, data: { courseId: c1._id } },
            { userId: uStudents.kabir._id, type: 'assignment_graded', title: '📝 Assignment Graded', message: 'Your JWT Auth API assignment scored 88/100. Great work!', data: { courseId: c1._id } },
            { userId: uStudents.pooja._id, type: 'certificate', title: '🏆 Certificate Ready!', message: `Your completion certificate for "${c7.title}" is ready to download.`, data: { courseId: c7._id } },
            { userId: uStudents.diya._id, type: 'new_lesson', title: '📚 New Lesson Available', message: `A new lesson "Electromagnetic Induction" has been added to "${c3.title}".`, data: { courseId: c3._id, lessonId: c3Lessons[2]._id } },
            { userId: uTutorVikram._id, type: 'new_review', title: '⭐ New Review', message: 'Aarav Patel left a 5-star review on your JEE Physics course.', data: { courseId: c3._id } },
            { userId: uTutorArjun._id, type: 'new_review', title: '⭐ New Review', message: 'Kabir Singh left a 5-star review on MERN Bootcamp.', data: { courseId: c1._id } },
            { userId: uStudents.aarav._id, type: 'fee_paid', title: '💰 Fee Payment Confirmed', message: 'Your quarterly tuition fee of ₹15,000 has been received.', data: {} },
            { userId: uApexAdmin._id, type: 'subscription_upgraded', title: '🔑 Subscription Active', message: 'Apex Academy Enterprise plan renewed successfully for 90 days.', data: {} },
        ];
        await Notification.insertMany(notifData);

        // ══════════════════════════════════════════════════════════════════════
        //  27. AI CHAT SESSIONS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [27/40] AI Chat Sessions...');
        await AIChatSession.create({
            userId: uStudents.aarav._id, title: 'Rotational Mechanics Doubts', courseId: c3._id, persona: 'student',
            messages: [
                { role: 'user', content: 'Can you explain the parallel axis theorem with an example?', contextUsed: false, timestamp: ago(2, 14) },
                { role: 'assistant', content: 'The **Parallel Axis Theorem** states: I = I_cm + Md²\n\nWhere:\n- I = Moment of inertia about any axis\n- I_cm = Moment of inertia about the center of mass\n- M = Total mass\n- d = Distance between the two parallel axes\n\n**Example:** For a solid disc (mass M, radius R) about a tangent:\n- I_cm (diameter) = (1/4)MR²\n- d = R (distance from center to tangent)\n- I_tangent = (1/4)MR² + MR² = **(5/4)MR²**\n\nThis is exactly how JEE problems test this concept!', contextUsed: true, citations: [{ title: 'Rotational Mechanics', content: 'Moment of inertia and parallel axis theorem', similarity: 0.92 }], timestamp: ago(2, 13, 58) },
                { role: 'user', content: 'What about the perpendicular axis theorem? When can I use it?', contextUsed: false, timestamp: ago(2, 13, 55) },
                { role: 'assistant', content: 'The **Perpendicular Axis Theorem** applies only to **planar (2D) bodies**:\n\nI_z = I_x + I_y\n\nWhere x, y, z are three mutually perpendicular axes with z perpendicular to the plane.\n\n**When to use:**\n- ✅ Flat disc, ring, rectangular plate\n- ❌ Solid sphere, cylinder, cone (3D bodies)\n\n**JEE Tip:** This theorem is commonly asked for finding I of a disc about its diameter when you know I about an axis through the center perpendicular to the disc.', contextUsed: true, timestamp: ago(2, 13, 50) },
            ],
        });
        await AIChatSession.create({
            userId: uStudents.kabir._id, title: 'Express Middleware Chain', courseId: c1._id, persona: 'student',
            messages: [
                { role: 'user', content: 'How does middleware ordering work in Express? Does app.use() order matter?', timestamp: ago(1, 8) },
                { role: 'assistant', content: 'Yes, **middleware order is critical** in Express.js!\n\nMiddleware executes in the order it\'s registered:\n\n```javascript\n// This runs first for ALL routes\napp.use(cors());\napp.use(express.json());\n\n// Auth middleware — runs before protected routes\napp.use(\'/api/protected\', authMiddleware);\n\n// Routes\napp.use(\'/api/users\', userRoutes);\n\n// Error handler — MUST be last\napp.use(errorHandler);\n```\n\n**Key Rules:**\n1. `cors()` and `express.json()` should be at the top\n2. Auth middleware before protected routes\n3. Error handling middleware always last (4 params: err, req, res, next)', contextUsed: true, timestamp: ago(1, 7, 58) },
            ],
        });

        // ══════════════════════════════════════════════════════════════════════
        //  28. AI USAGE LOGS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [28/40] AI Usage Logs...');
        const aiLogEntries = [
            { userId: uStudents.aarav._id, instituteId: apexInstitute._id, action: 'tutor_chat', tokenCount: 1250, model: 'groq' },
            { userId: uStudents.aarav._id, instituteId: apexInstitute._id, action: 'doubt_solver', tokenCount: 800, model: 'groq' },
            { userId: uStudents.kabir._id, instituteId: zenithInstitute._id, action: 'tutor_chat_session', tokenCount: 2100, model: 'groq' },
            { userId: uTutorVikram._id, instituteId: apexInstitute._id, action: 'question_generation', tokenCount: 3500, model: 'groq', details: { examTitle: 'JEE Physics Mock', questionsGenerated: 15 } },
            { userId: uTutorArjun._id, instituteId: zenithInstitute._id, action: 'summarize_lesson', tokenCount: 1800, model: 'groq' },
            { userId: uTutorMeera._id, action: 'question_generation', tokenCount: 2200, model: 'groq', details: { examTitle: 'ML Basics Quiz', questionsGenerated: 10 } },
            { userId: uStudents.pooja._id, action: 'contextual_chat', tokenCount: 950, model: 'groq' },
            { userId: uStudents.diya._id, instituteId: apexInstitute._id, action: 'revision_notes', tokenCount: 1500, model: 'groq' },
            { userId: uTutorRohan._id, action: 'analytics', tokenCount: 600, model: 'groq' },
        ];
        await AIUsageLog.insertMany(aiLogEntries);

        // ══════════════════════════════════════════════════════════════════════
        //  29. DOUBT LOGS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [29/40] Doubt Logs...');
        await DoubtLog.insertMany([
            { userId: uStudents.aarav._id, instituteId: apexInstitute._id, courseId: c3._id, question: 'Why does a spinning top not fall over when rotating fast but falls when it slows down?', answer: 'This is due to **gyroscopic precession**. When the top spins fast, its angular momentum vector is large and stable. The gravitational torque causes precession (wobbling around the vertical) instead of toppling. As it slows down, the angular momentum decreases, and gravity dominates, causing it to fall.', subject: 'Physics', difficulty: 'Medium', rating: 5, role: 'student' },
            { userId: uStudents.kabir._id, instituteId: zenithInstitute._id, courseId: c1._id, question: 'What is the difference between authentication and authorization in web apps?', answer: '**Authentication** = Verifying WHO you are (login with email/password, OAuth, JWT).\n**Authorization** = Verifying WHAT you can do (admin can delete users, student can only view courses).\n\nIn Express: Authentication middleware checks the JWT token, Authorization middleware checks the user role.', subject: 'Web Development', difficulty: 'Easy', rating: 5, role: 'student' },
            { userId: uStudents.diya._id, instituteId: apexInstitute._id, courseId: c5._id, question: 'What is the difference between mitosis and meiosis?', answer: '**Mitosis**: 1 division → 2 identical diploid cells. For growth & repair.\n**Meiosis**: 2 divisions → 4 genetically different haploid cells. For gamete production.\n\nKey differences: crossing over occurs only in meiosis (prophase I), and chromosome number is halved in meiosis but maintained in mitosis.', subject: 'Biology', difficulty: 'Easy', rating: 4, role: 'student' },
        ]);

        // ══════════════════════════════════════════════════════════════════════
        //  30. STUDY PLANS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [30/40] Study Plans...');
        await StudyPlan.create({
            tutorId: tVikram._id, studentId: uStudents.aarav._id, courseId: c3._id, instituteId: apexInstitute._id,
            title: 'Aarav\'s JEE Physics 45-Day Crash Plan', studentName: 'Aarav Patel',
            weakTopics: ['Electromagnetic Induction', 'Wave Optics', 'Rotational Mechanics'],
            durationWeeks: 6, hoursPerDay: 3, difficulty: 'intensive',
            goal: 'Score 85+ in JEE Main Physics by mastering weak chapters through daily problem practice.',
            weeklyPlan: [
                { day: 'Monday', date: 'Week 1', topics: [{ title: 'Rotational Mechanics — Moment of Inertia', duration: '90 mins', type: 'study', description: 'Parallel & perpendicular axis theorems with 20 numericals.' }, { title: 'Practice Set — Rolling Motion', duration: '60 mins', type: 'practice', description: 'Solve 15 JEE-level rolling motion problems.' }], totalMinutes: 150, focus: 'Concept Building' },
                { day: 'Tuesday', date: 'Week 1', topics: [{ title: 'Electromagnetic Induction — Faraday\'s Law', duration: '90 mins', type: 'study', description: 'Lenz\'s law, mutual inductance, AC generators.' }, { title: 'Quick Quiz — EMI Concepts', duration: '30 mins', type: 'quiz', description: '10 MCQs on electromagnetic induction fundamentals.' }], totalMinutes: 120, focus: 'Concept + Assessment' },
            ],
            summary: 'A 6-week intensive plan targeting Aarav\'s 3 weak chapters with daily 3-hour sessions.',
            keyMilestones: ['Complete Rotational Mechanics by Week 2', 'Score 70%+ in EMI mock test by Week 4', 'Full-length mock test with 80%+ by Week 6'],
            estimatedScore: 85, totalDays: 42, totalStudyHours: 126, topicsCount: 15, status: 'active',
        });

        // ══════════════════════════════════════════════════════════════════════
        //  31. NOTES
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [31/40] Notes...');
        await Note.insertMany([
            { studentId: uStudents.aarav._id, courseId: c3._id, lessonId: c3Lessons[0]._id, title: 'Newton\'s Laws — Key Formulas', content: '<h3>Newton\'s Laws Quick Reference</h3><ul><li><b>First Law:</b> F=0 → v=const (inertia)</li><li><b>Second Law:</b> F=ma (net force = mass × acceleration)</li><li><b>Third Law:</b> F₁₂ = -F₂₁ (action-reaction pairs)</li></ul><p><b>JEE Tip:</b> Always draw FBD before applying F=ma. Resolve forces along and perpendicular to incline.</p>' },
            { studentId: uStudents.kabir._id, courseId: c1._id, lessonId: c1Lessons[2]._id, title: 'Express.js Middleware Notes', content: '<h3>Express Middleware Cheat Sheet</h3><ul><li><b>app.use()</b> — Mounts middleware for all routes</li><li><b>next()</b> — Passes control to next middleware</li><li><b>Error middleware</b> — Must have 4 params (err, req, res, next)</li></ul><p>Order matters! CORS → JSON parser → Auth → Routes → Error handler</p>' },
            { studentId: uStudents.diya._id, courseId: c5._id, lessonId: c5Lessons[0]._id, title: 'Cell Organelles Summary', content: '<h3>Cell Organelles</h3><ul><li><b>Mitochondria:</b> Powerhouse, double membrane, own DNA</li><li><b>ER:</b> Rough (ribosomes) → protein synthesis, Smooth → lipid synthesis</li><li><b>Golgi:</b> Packaging & transport, cis (receiving) → trans (shipping)</li></ul>' },
        ]);

        // ══════════════════════════════════════════════════════════════════════
        //  32. SIMPLIFIED NOTES
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [32/40] Simplified Notes...');
        await SimplifiedNote.create({
            userId: uStudents.aarav._id, instituteId: apexInstitute._id, courseId: c3._id,
            originalText: 'The moment of inertia of a body about an axis is defined as the sum of the products of the mass of each particle and the square of its distance from the axis of rotation. Mathematically, I = Σmᵢrᵢ². For continuous bodies, this becomes an integral: I = ∫r²dm. The parallel axis theorem states that I = I_cm + Md², where I_cm is the moment of inertia about an axis through the center of mass.',
            sourceType: 'text', simplifiedText: '**Moment of Inertia (I)** = How hard it is to spin something.\n\n• **Formula:** I = Σmr² (sum of mass × distance²)\n• **Continuous bodies:** I = ∫r²dm\n• **Parallel Axis Theorem:** I = I_cm + Md²\n\nThink of it like: heavier things further from the axis = harder to spin!',
            gradeLevel: '11th Grade', originalWordCount: 72, simplifiedWordCount: 42, wordsReduced: 30, infoRetained: 95,
            title: 'Moment of Inertia — Simplified',
        });

        // Tutor-shared simplified note
        await SimplifiedNote.create({
            userId: uTutorVikram._id, instituteId: apexInstitute._id, courseId: c3._id,
            originalText: 'Rotational dynamics covers torque, angular momentum, and the conservation of angular momentum. Torque is the rotational equivalent of linear force, defined as the vector product of position vector and force vector. Angular momentum of a rigid body is the product of its moment of inertia and angular velocity.',
            sourceType: 'text',
            simplifiedText: '**Rotational Dynamics Made Simple!**\n\n• **Torque (τ):** Rotational force. τ = r × F (r = distance from pivot, F = force applied).\n• **Angular Momentum (L):** Rotational momentum. L = I × ω (I = Moment of Inertia, ω = Angular velocity).\n• **Conservation of L:** If net external torque is zero, angular momentum remains constant!',
            gradeLevel: '11th Grade', originalWordCount: 42, simplifiedWordCount: 28, wordsReduced: 14, infoRetained: 98,
            title: 'Rotational Dynamics Cheat Sheet',
            sharedToCourses: [{
                courseId: c3._id,
                lessonId: c3Lessons[1]._id,
                sharedAt: ago(1)
            }]
        });

        // Lecture Summaries
        await LectureSummary.create({
            userId: uTutorVikram._id, instituteId: apexInstitute._id, courseId: c3._id, lessonId: c3Lessons[0]._id,
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
            pageCount: 3, keyPointCount: 3, minutesSaved: 45, accuracy: 98
        });

        // Generated Reports
        await GeneratedReport.create({
            tutorId: tVikram._id, instituteId: apexInstitute._id, reportType: 'student',
            title: 'JEE Physics Academic Performance Report',
            description: 'Comprehensive evaluation of Aarav Patel for the IIT JEE Physics Course.',
            studentIds: [uStudents.aarav._id], studentNames: ['Aarav Patel'],
            courseId: c3._id, courseName: c3.title, highlightStrengths: true,
            summary: 'Aarav has demonstrated exceptional performance across the core concepts of mechanics. He shows a high aptitude for algebraic derivation and application of Faraday\'s laws. His primary area of concern is continuous body moment of inertia calculations.',
            students: [{
                studentId: uStudents.aarav._id,
                name: 'Aarav Patel',
                avatar: null,
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
        });

        // ══════════════════════════════════════════════════════════════════════
        //  33. LESSON COMMENTS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [33/40] Lesson Comments...');
        const comment1 = await LessonComment.create({ lessonId: c3Lessons[0]._id, studentId: uStudents.aarav._id, text: 'Vikram sir, at 8:45 in the video, how do we handle the constraint equation when the string is massless but the pulley has mass?', moderationStatus: 'visible' });
        await LessonComment.findByIdAndUpdate(comment1._id, { tutorReply: { text: 'Great question Aarav! When pulley has mass, its moment of inertia (I = ½MR²) creates different tensions on both sides. Use τ = Iα along with F=ma for each block. I\'ll cover this in detail in next week\'s live session!', tutorUserId: uTutorVikram._id, repliedAt: ago(1, 6) } });

        await LessonComment.create({ lessonId: c1Lessons[2]._id, studentId: uStudents.nisha._id, text: 'Can we use app.route() instead of creating separate router files? What are the trade-offs?', moderationStatus: 'visible' });
        await LessonComment.create({ lessonId: c1Lessons[0]._id, studentId: uStudents.kabir._id, text: 'The destructuring section was incredibly clear. I finally understand nested destructuring with default values!', moderationStatus: 'visible' });

        // ══════════════════════════════════════════════════════════════════════
        //  34. WISHLISTS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [34/40] Wishlists...');
        await Wishlist.insertMany([
            { user: uStudents.aarav._id, course: c2._id },
            { user: uStudents.aarav._id, course: c6._id },
            { user: uStudents.kabir._id, course: c6._id },
            { user: uStudents.diya._id, course: c7._id },
            { user: uStudents.pooja._id, course: c3._id },
            { user: uStudents.aryan._id, course: c1._id },
        ]);

        // ══════════════════════════════════════════════════════════════════════
        //  35. BLOGS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [35/40] Blogs...');
        await Blog.insertMany([
            { title: '10 React Performance Tips Every Developer Should Know', slug: '10-react-performance-tips-2026', excerpt: 'Learn how to optimize your React apps with memoization, code splitting, and virtual DOM strategies.', content: '## 1. Use React.memo wisely\nWrap components that receive the same props frequently...\n\n## 2. Implement Code Splitting\nUse React.lazy() and Suspense for route-based splitting...\n\n## 3. Virtualize Long Lists\nUse react-window or react-virtualized for lists with 1000+ items...\n\n## 4. Optimize useEffect Dependencies\nAvoid unnecessary re-renders by specifying exact dependencies...\n\n## 5. Use useMemo for Expensive Calculations\nMemoize computed values that depend on specific inputs...', thumbnail: 'https://images.unsplash.com/photo-1633356122102-3fe601e05bd2?w=800&auto=format&fit=crop&q=60', author: uTutorRohan._id, status: 'published', tags: ['React', 'Performance', 'JavaScript'], category: 'Web Development' },
            { title: 'How I Scored 99.8 Percentile in JEE Physics', slug: 'jee-physics-99-percentile-strategy', excerpt: 'A detailed strategy guide for JEE Physics preparation based on my personal experience.', content: '## The Foundation\nStart with NCERT, not reference books. Build concepts first...\n\n## Practice Strategy\nSolve at least 50 problems per chapter from past year papers...\n\n## Time Management\nAllocate 2 hours daily for Physics. Rotate between theory and numericals...\n\n## Mock Tests\nTake at least 30 full-length mocks in the last 2 months...', thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop&q=60', author: uTutorVikram._id, status: 'published', tags: ['JEE', 'Physics', 'Strategy'], category: 'Exam Preparation' },
            { title: 'Getting Started with Machine Learning in 2026', slug: 'ml-getting-started-2026', excerpt: 'A beginner-friendly roadmap to learn Machine Learning from scratch.', content: '## Prerequisites\nLearn Python basics, linear algebra, and probability...\n\n## Step 1: Data Manipulation\nMaster NumPy and Pandas for data cleaning and transformation...\n\n## Step 2: Visualization\nLearn Matplotlib and Seaborn for exploratory data analysis...\n\n## Step 3: Your First ML Model\nStart with Linear Regression using Scikit-learn...', thumbnail: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=800&auto=format&fit=crop&q=60', author: uTutorMeera._id, status: 'published', tags: ['Machine Learning', 'Python', 'Data Science'], category: 'Data Science' },
        ]);

        // ══════════════════════════════════════════════════════════════════════
        //  36. LEADS (CRM)
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [36/40] Leads...');
        await Lead.insertMany([
            { name: 'Rahul Verma', email: 'rahul.v@gmail.com', phone: '+919111222333', courseOfInterest: c3._id, message: 'Interested in JEE Physics crash course. Can I get a trial lecture?', status: 'new', source: 'website', conversionStatus: 'none' },
            { name: 'Shruti Jain', email: 'shruti.j@gmail.com', phone: '+919222333444', courseOfInterest: c1._id, message: 'Looking for MERN bootcamp. Do you offer EMI payment option?', status: 'contacted', source: 'website', conversionStatus: 'trial', assignedCounselor: uApexAdmin._id, notes: [{ text: 'Called and explained EMI options. Interested in MERN Cohort-8.', addedBy: uApexAdmin._id }] },
            { name: 'Deepak Rao', email: 'deepak.rao@gmail.com', phone: '+919333444555', courseOfInterest: c6._id, message: 'Want to transition from manual testing to data science. Is this course right for me?', status: 'qualified', source: 'website', conversionStatus: 'enrolled', convertedAt: ago(5), conversionValue: 2499 },
        ]);

        // ══════════════════════════════════════════════════════════════════════
        //  37. QUIZ ATTEMPTS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [37/40] Quiz Attempts...');
        const quizLesson = c1Lessons[4]; // Backend Fundamentals Quiz
        if (quizLesson && quizLesson.content?.quiz) {
            await QuizAttempt.create({
                studentId: uStudents.kabir._id, lessonId: quizLesson._id, courseId: c1._id,
                quizTitle: 'Backend Fundamentals Quiz', totalQuestions: 2, totalPoints: 10,
                answers: [
                    { questionId: String(quizLesson.content.quiz.questions[0]._id), selectedOptionIndex: 1, isCorrect: true, pointsEarned: 5, timeTaken: 45 },
                    { questionId: String(quizLesson.content.quiz.questions[1]._id), selectedOptionIndex: 1, isCorrect: true, pointsEarned: 5, timeTaken: 30 },
                ],
                score: 100, pointsEarned: 10, pointsPossible: 10, isPassed: true,
                startedAt: ago(3, 2), submittedAt: ago(3, 1, 45), timeSpent: 75, attemptNumber: 1,
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        //  38. LEARNING EVENTS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [38/40] Learning Events...');
        const eventData = [
            { eventType: 'attendance_marked', userId: uStudents.aarav._id, role: 'student', instituteId: apexInstitute._id, courseId: c3._id, batchId: b1._id, meta: { status: 'present' } },
            { eventType: 'live_class_joined', userId: uStudents.kabir._id, role: 'student', instituteId: zenithInstitute._id, courseId: c1._id, batchId: b3._id, resourceId: lc2._id, resourceType: 'LiveClass' },
            { eventType: 'assignment_submitted', userId: uStudents.aarav._id, role: 'student', instituteId: apexInstitute._id, courseId: c3._id, batchId: b1._id, resourceId: asn1._id, resourceType: 'Assignment' },
            { eventType: 'exam_submitted', userId: uStudents.aarav._id, role: 'student', instituteId: apexInstitute._id, courseId: c3._id, batchId: b1._id, resourceId: exam1._id, resourceType: 'Exam' },
            { eventType: 'exam_submitted', userId: uStudents.kabir._id, role: 'student', instituteId: zenithInstitute._id, courseId: c1._id, batchId: b3._id, resourceId: exam2._id, resourceType: 'Exam' },
        ];
        await LearningEvent.insertMany(eventData);

        // ══════════════════════════════════════════════════════════════════════
        //  39. APPOINTMENTS
        // ══════════════════════════════════════════════════════════════════════
        console.log('🌱 [39/40] Appointments...');
        await Appointment.insertMany([
            { studentId: uStudents.aarav._id, tutorId: tVikram._id, dateTime: future(1, 18), duration: 60, status: 'confirmed', amount: 200, notes: 'Need help with electromagnetic induction numericals.', meetingLink: 'https://zoom.us/j/4444444444', sessionType: 'online_live' },
            { studentId: uStudents.kabir._id, tutorId: tArjun._id, dateTime: future(2, 10), duration: 45, status: 'pending', amount: 250, notes: 'Code review for my e-commerce project submission.', meetingLink: 'https://zoom.us/j/5555555555', sessionType: 'online_live' },
            { studentId: uStudents.aditya._id, tutorId: tRohanV._id, dateTime: future(3, 15), duration: 60, status: 'confirmed', amount: 300, notes: 'Want guidance on building a design system for my startup.', meetingLink: 'https://zoom.us/j/6666666666', sessionType: 'online_live' },
            { studentId: uStudents.pooja._id, tutorId: tMeera._id, dateTime: ago(2, 14), duration: 45, status: 'completed', amount: 280, notes: 'Discussed feature engineering techniques for housing price prediction.', meetingLink: 'https://zoom.us/j/7777777777', sessionType: 'online_live' },
        ]);

        // ══════════════════════════════════════════════════════════════════════
        //  40. DONE — Final stats
        // ══════════════════════════════════════════════════════════════════════
        console.log('\n🔢 Counting documents...');
        const counts = {};
        const finalCollections = await mongoose.connection.db.listCollections().toArray();
        for (const col of finalCollections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            if (count > 0) counts[col.name] = count;
        }

        console.log('\n══════════════════════════════════════════════════════════');
        console.log('✅ DATABASE SEED COMPLETED SUCCESSFULLY!');
        console.log('══════════════════════════════════════════════════════════');
        console.log('\n📊 Collection counts:');
        Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
            console.log(`   ${name.padEnd(28)} ${count}`);
        });
        console.log('\n🔑 Login Credentials (Password: password123):');
        console.log('──────────────────────────────────────────────────────────');
        console.log('   SUPERADMIN:');
        console.log('     superadmin@sapience.io');
        console.log('   APEX ACADEMY (Institute Admin / Tutors / Students):');
        console.log('     admin@apexacademy.in');
        console.log('     vikram@apexacademy.in   |   sneha@apexacademy.in');
        console.log('     aarav.patel@gmail.com   |   diya.sharma@gmail.com');
        console.log('     ishaan.gupta@gmail.com  |   ananya.reddy@gmail.com');
        console.log('     tanvi.mishra@gmail.com');
        console.log('   ZENITH TECH SPACE (Institute Admin / Tutors / Students):');
        console.log('     admin@zenithtech.io');
        console.log('     arjun@zenithtech.io     |   kavita@zenithtech.io');
        console.log('     kabir.singh@gmail.com   |   nisha.agarwal@gmail.com');
        console.log('     vivaan.kumar@gmail.com  |   sanya.bhatia@gmail.com');
        console.log('   CROSS-ENROLLED:');
        console.log('     riya.choudhury@gmail.com (Apex + Zenith)');
        console.log('   INDEPENDENT TUTORS (Tutor Pro):');
        console.log('     rohan.verma@gmail.com   |   meera.joshi@gmail.com');
        console.log('   INDEPENDENT STUDENTS:');
        console.log('     aditya.malhotra@gmail.com | pooja.saxena@gmail.com');
        console.log('     aryan.thakur@gmail.com');
        console.log('══════════════════════════════════════════════════════════\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ SEEDING FAILED:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

seed();
