import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Institute } from './src/models/Institute.js';
import User from './src/models/User.js';
import Course from './src/models/Course.js';
import Batch from './src/models/Batch.js';
import Exam from './src/models/Exam.js';
import LiveClass from './src/models/LiveClass.js';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    try {
        console.log("Connected to DB...");

        let defaultInstitute = await Institute.findOne({ subdomain: 'default' });
        if (!defaultInstitute) {
            defaultInstitute = new Institute({
                name: 'Sapience Global',
                subdomain: 'default',
                subscriptionPlan: 'enterprise'
            });
            await defaultInstitute.save();
            console.log("Created Default Institute.");
        }

        const userRes = await User.updateMany(
            { instituteId: null, role: { $ne: 'superadmin' } },
            { $set: { instituteId: defaultInstitute._id } }
        );

        const courseRes = await Course.updateMany(
            { instituteId: null },
            { $set: { instituteId: defaultInstitute._id } }
        );

        const batchRes = await Batch.updateMany(
            { instituteId: null },
            { $set: { instituteId: defaultInstitute._id } }
        );

        const examRes = await Exam.updateMany(
            { instituteId: null },
            { $set: { instituteId: defaultInstitute._id } }
        );

        const liveClassRes = await LiveClass.updateMany(
            { instituteId: null },
            { $set: { instituteId: defaultInstitute._id } }
        );

        console.log("MIGRATED USERS:", userRes.modifiedCount);
        console.log("MIGRATED COURSES:", courseRes.modifiedCount);
        console.log("MIGRATED BATCHES:", batchRes.modifiedCount);
        console.log("MIGRATED EXAMS:", examRes.modifiedCount);
        console.log("MIGRATED LIVE CLASSES:", liveClassRes.modifiedCount);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
});
