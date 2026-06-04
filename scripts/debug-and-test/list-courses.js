import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Course from '../../src/models/Course.js';
import User from '../../src/models/User.js';
import Tutor from '../../src/models/Tutor.js';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const courses = await Course.find({}).lean();
        console.log(`Found ${courses.length} courses:`);
        for (const c of courses) {
            const user = await User.findById(c.createdBy).lean();
            console.log(`- Course ID: ${c._id}`);
            console.log(`  Title: ${c.title}`);
            console.log(`  Thumbnail: "${c.thumbnail}"`);
            console.log(`  Created By: ${user?.name || 'Unknown'} (${c.createdBy})`);
            console.log(`  Status: ${c.status}`);
        }
        
        await mongoose.disconnect();
        console.log('Disconnected');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
