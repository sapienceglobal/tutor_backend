import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;

    const tutors = await db.collection('tutors').find({}).project({ userId: 1, _id: 1 }).toArray();
    const users = await db.collection('users').find({ role: 'tutor' }).project({ _id: 1, email: 1, role: 1 }).toArray();

    fs.writeFileSync('db_out.json', JSON.stringify({ tutors, users }, null, 2));
    process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
