import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { Institute } from '../src/models/Institute.js';
import User from '../src/models/User.js';

const migrateInstitutes = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected...');

        // 1. Create Default Institute
        let defaultInstitute = await Institute.findOne({ subdomain: 'default' });

        if (!defaultInstitute) {
            defaultInstitute = new Institute({
                name: 'Sapience Global',
                subdomain: 'default',
                subscriptionPlan: 'enterprise',
                features: {
                    hlsStreaming: true,
                    customBranding: true,
                    zoomIntegration: true,
                    aiFeatures: true
                }
            });
            await defaultInstitute.save();
            console.log('Created Default Institute: Sapience Global');
        } else {
            console.log('Default Institute already exists.');
        }

        // 2. Migrate Users
        const users = await User.find({ instituteId: null, role: { $ne: 'superadmin' } });
        console.log(`Found ${users.length} users to migrate.`);
        let migratedUsers = 0;

        for (let user of users) {
            user.instituteId = defaultInstitute._id;
            await user.save();
            migratedUsers++;
        }
        console.log(`Migrated ${migratedUsers} users to default institute.`);

        console.log('Migration Completed.');
        process.exit(0);
    } catch (err) {
        console.error('Migration Error:', err);
        process.exit(1);
    }
};

migrateInstitutes();
