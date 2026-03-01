import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Institute } from '../src/models/Institute.js';
import User from '../src/models/User.js';

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const count = await Institute.countDocuments();
        const users = await User.countDocuments({ instituteId: { $ne: null } });
        fs.writeFileSync('migration_status.json', JSON.stringify({ instituteCount: count, migratedUsers: users }));
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('migration_status.json', JSON.stringify({ error: e.message }));
        process.exit(1);
    }
}
check();
