import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import SubscriptionPlan from '../src/models/SubscriptionPlan.js';

// Resolve filename and path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function seed() {
    try {
        console.log('🔄 Connecting to MongoDB at:', MONGODB_URI);
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB Connected Successfully');

        // Delete existing personal plans
        console.log('🗑️ Removing existing personal subscription plans...');
        await SubscriptionPlan.deleteMany({ planType: 'personal' });

        const plans = [
            // ==================== TUTOR PERSONAL PLANS ====================
            {
                name: 'Tutor Starter',
                price: 2999,
                billingCycle: 'monthly',
                planType: 'personal',
                planRole: 'tutor',
                isPopular: false,
                features: {
                    maxTutors: 1,
                    maxStudents: 100,
                    storageLimitGB: 15,
                    hlsStreaming: false,
                    customBranding: false,
                    zoomIntegration: true,
                    apiAccess: false,
                    aiAssistant: true,
                    aiAssessment: false,
                    aiIntelligence: false,
                    aiCreditsPerMonth: 2000
                }
            },
            {
                name: 'Tutor Pro',
                price: 7999,
                billingCycle: 'monthly',
                planType: 'personal',
                planRole: 'tutor',
                isPopular: true,
                features: {
                    maxTutors: 1,
                    maxStudents: 500,
                    storageLimitGB: 100,
                    hlsStreaming: true,
                    customBranding: true,
                    zoomIntegration: true,
                    apiAccess: false,
                    aiAssistant: true,
                    aiAssessment: true,
                    aiIntelligence: false,
                    aiCreditsPerMonth: 8000
                }
            },
            {
                name: 'Tutor Enterprise',
                price: 19999,
                billingCycle: 'monthly',
                planType: 'personal',
                planRole: 'tutor',
                isPopular: false,
                features: {
                    maxTutors: 1,
                    maxStudents: -1, // Unlimited
                    storageLimitGB: 500,
                    hlsStreaming: true,
                    customBranding: true,
                    zoomIntegration: true,
                    apiAccess: true,
                    aiAssistant: true,
                    aiAssessment: true,
                    aiIntelligence: true,
                    aiCreditsPerMonth: 25000
                }
            },

            // ==================== STUDENT PERSONAL PLANS ====================
            {
                name: 'Student Learner',
                price: 499,
                billingCycle: 'monthly',
                planType: 'personal',
                planRole: 'student',
                isPopular: false,
                features: {
                    maxTutors: 0,
                    maxStudents: 1,
                    storageLimitGB: 2,
                    hlsStreaming: false,
                    customBranding: false,
                    zoomIntegration: false,
                    apiAccess: false,
                    aiAssistant: true,
                    aiAssessment: false,
                    aiIntelligence: false,
                    aiCreditsPerMonth: 500
                }
            },
            {
                name: 'Student Scholar',
                price: 999,
                billingCycle: 'monthly',
                planType: 'personal',
                planRole: 'student',
                isPopular: true,
                features: {
                    maxTutors: 0,
                    maxStudents: 1,
                    storageLimitGB: 10,
                    hlsStreaming: false,
                    customBranding: false,
                    zoomIntegration: false,
                    apiAccess: false,
                    aiAssistant: true,
                    aiAssessment: true,
                    aiIntelligence: false,
                    aiCreditsPerMonth: 1500
                }
            },
            {
                name: 'Student Ultimate',
                price: 1999,
                billingCycle: 'monthly',
                planType: 'personal',
                planRole: 'student',
                isPopular: false,
                features: {
                    maxTutors: 0,
                    maxStudents: 1,
                    storageLimitGB: 30,
                    hlsStreaming: false,
                    customBranding: false,
                    zoomIntegration: false,
                    apiAccess: false,
                    aiAssistant: true,
                    aiAssessment: true,
                    aiIntelligence: true,
                    aiCreditsPerMonth: 5000
                }
            }
        ];

        console.log('🌱 Seeding fresh high-fidelity personal plans...');
        const seeded = await SubscriptionPlan.insertMany(plans);
        console.log(`✅ Successfully seeded ${seeded.length} personal plans!`);

    } catch (error) {
        console.error('❌ Seeding failed with error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 MongoDB Disconnected Safely');
    }
}

seed();
