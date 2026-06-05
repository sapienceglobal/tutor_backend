import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Tutor from '../src/models/Tutor.js';
import Course from '../src/models/Course.js';
import Batch from '../src/models/Batch.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Adarsh:adarsh2424@cluster0.3ynbxui.mongodb.net/tutorManagementDb';

async function check() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');
        
        const studentId = '69a6883864d91541fece2f56';
        
        const batches = await Batch.find({ students: studentId })
            .populate('courseId', 'title thumbnail isFree status')
            .populate({
                path: 'tutorId',
                populate: { path: 'userId', select: 'name profileImage' }
            });
            
        console.log('Found my batches count:', batches.length);
        batches.forEach(b => {
            console.log(`Batch: ${b.name}`);
            console.log(`  tutorId:`, JSON.stringify(b.tutorId, null, 2));
        });
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
