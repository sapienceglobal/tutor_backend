import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("DB Connected.");

        const db = mongoose.connection.db;
        const institutes = db.collection('institutes');
        const users = db.collection('users');
        const courses = db.collection('courses');
        const batches = db.collection('batches');
        const exams = db.collection('exams');
        const liveclasses = db.collection('liveclasses');

        let defaultInst = await institutes.findOne({ subdomain: 'default' });
        if (!defaultInst) {
            const res = await institutes.insertOne({
                name: 'Sapience Global',
                subdomain: 'default',
                subscriptionPlan: 'enterprise',
                features: {
                    hlsStreaming: true,
                    customBranding: true,
                    zoomIntegration: true,
                    aiFeatures: true
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            defaultInst = { _id: res.insertedId };
            console.log("Created Institute.");
        } else {
            console.log("Institute exists.");
        }

        const uRes = await users.updateMany({ instituteId: null, role: { $ne: 'superadmin' } }, { $set: { instituteId: defaultInst._id } });
        const cRes = await courses.updateMany({ instituteId: null }, { $set: { instituteId: defaultInst._id } });
        const bRes = await batches.updateMany({ instituteId: null }, { $set: { instituteId: defaultInst._id } });
        const eRes = await exams.updateMany({ instituteId: null }, { $set: { instituteId: defaultInst._id } });
        const lRes = await liveclasses.updateMany({ instituteId: null }, { $set: { instituteId: defaultInst._id } });

        console.log({
            migratedUsers: uRes.modifiedCount,
            migratedCourses: cRes.modifiedCount,
            migratedBatches: bRes.modifiedCount,
            migratedExams: eRes.modifiedCount,
            migratedLiveClasses: lRes.modifiedCount
        });

        process.exit(0);
    } catch (e) {
        console.error("ERROR", e);
        process.exit(1);
    }
};

run();
