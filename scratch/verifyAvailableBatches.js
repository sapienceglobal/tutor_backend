import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../src/models/User.js';
import Course from '../src/models/Course.js';
import Tutor from '../src/models/Tutor.js';
import Batch from '../src/models/Batch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function run() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        const aarav = await User.findOne({ email: 'aarav.patel@gmail.com' });
        if (!aarav) {
            console.log('❌ Aarav Patel not found');
            return;
        }

        const studentId = aarav._id;
        // Check with and without tenantId
        // Assuming Aarav is part of Apex Institute: 6a32b935722ad9c7782943d6
        const tenantId = aarav.instituteId || '6a32b935722ad9c7782943d6';

        console.log(`👤 Student: ${aarav.name} (${studentId})`);
        console.log(`🏫 Institute: ${tenantId}`);

        const scopeFilter = {
            $or: [
                { instituteId: tenantId },
                { instituteId: null }
            ]
        };

        const batches = await Batch.find({
            ...scopeFilter,
            students: { $ne: studentId },
            status: { $ne: 'inactive' }
        }).populate('courseId', 'title');

        console.log(`\n📚 Found ${batches.length} Available Batches for Aarav:`);
        batches.forEach(b => {
            console.log(`- ${b.name}`);
            console.log(`  Course: ${b.courseId?.title}`);
            console.log(`  Scope: ${b.instituteId ? 'Institute' : 'Global'}`);
            console.log(`  Status: ${b.status}`);
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔄 Disconnected.');
    }
}

run();
