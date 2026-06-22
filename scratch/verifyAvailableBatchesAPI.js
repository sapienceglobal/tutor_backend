import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../src/models/User.js';
import Batch from '../src/models/Batch.js';
import Enrollment from '../src/models/Enrollment.js';
import { getAvailableBatches, joinBatch } from '../src/controllers/batchController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function run() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        // Find Aarav Patel
        const aarav = await User.findOne({ email: 'aarav.patel@gmail.com' });
        if (!aarav) {
            console.error('❌ Aarav Patel not found');
            return;
        }

        console.log(`👤 Student: ${aarav.name} (ID: ${aarav._id})`);

        // 1. Get Available Batches
        const reqAvail = {
            user: { _id: aarav._id },
            tenant: { _id: new mongoose.Types.ObjectId('6a32b935722ad9c7782943d6') } // Apex Institute ID
        };

        let responseStatus = 200;
        let responseData = null;

        const resMock = {
            status(code) {
                responseStatus = code;
                return this;
            },
            json(data) {
                responseData = data;
                return this;
            }
        };

        console.log('\n📡 Invoking getAvailableBatches controller...');
        await getAvailableBatches(reqAvail, resMock);

        console.log(`Response Status: ${responseStatus}`);
        if (!responseData || !responseData.success) {
            console.error('❌ getAvailableBatches failed:', responseData);
            return;
        }

        console.log(`✅ Success! Found ${responseData.count} available batches.`);

        // Find the React Advanced Cohort — Global batch
        const reactBatch = responseData.batches.find(b => b.name === 'React Advanced Cohort — Global');
        if (!reactBatch) {
            console.error('❌ React Advanced Cohort — Global batch not found in available list.');
            return;
        }

        console.log(`\n👉 Found batch to join: ${reactBatch.name} (ID: ${reactBatch._id})`);

        // 2. Attempt to join React batch
        const reqJoin = {
            user: { _id: aarav._id },
            tenant: { _id: new mongoose.Types.ObjectId('6a32b935722ad9c7782943d6') },
            params: { id: reactBatch._id.toString() }
        };

        let joinStatus = 200;
        let joinData = null;

        const resJoin = {
            status(code) {
                joinStatus = code;
                return this;
            },
            json(data) {
                joinData = data;
                return this;
            }
        };

        console.log('📡 Invoking joinBatch controller...');
        await joinBatch(reqJoin, resJoin);

        console.log(`Response Status: ${joinStatus}`);
        console.log('Response Message:', joinData?.message);

        if (joinStatus === 200 && joinData?.success) {
            console.log('✅ Aarav successfully joined the batch!');
            
            // Verify DB state
            const updatedBatch = await Batch.findById(reactBatch._id);
            console.log('Students in batch after joining:', updatedBatch.students);
            const isJoined = updatedBatch.students.some(s => s.toString() === aarav._id.toString());
            console.log(`Verify student added to batch: ${isJoined ? 'SUCCESS' : 'FAILED'}`);

            const enrollment = await Enrollment.findOne({ studentId: aarav._id, courseId: reactBatch.courseId });
            console.log(`Verify batchId in student enrollment: ${enrollment?.batchId?.toString() === reactBatch._id.toString() ? 'SUCCESS' : 'FAILED'} (batchId: ${enrollment?.batchId})`);

            // Clean up by removing Aarav from the batch so the test remains repeatable/runnable again
            updatedBatch.students = updatedBatch.students.filter(s => s.toString() !== aarav._id.toString());
            await updatedBatch.save();
            enrollment.batchId = undefined;
            await enrollment.save();
            console.log('🧹 Cleaned up and reset database changes.');
        } else {
            console.error('❌ joinBatch failed:', joinData);
        }

    } catch (err) {
        console.error('❌ Error during mock validation:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔄 Disconnected.');
    }
}

run();
