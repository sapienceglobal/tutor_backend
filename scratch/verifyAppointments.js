import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../src/models/User.js';
import Tutor from '../src/models/Tutor.js';
import ScheduleAppointment from '../src/models/Appointment_Schedule.js';
import Appointment from '../src/models/Appointment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function run() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected.');

        // Find Vikram
        const vikramUser = await User.findOne({ email: 'vikram@apexacademy.in' });
        if (!vikramUser) {
            console.error('❌ Vikram not found');
            return;
        }
        const vikramTutor = await Tutor.findOne({ userId: vikramUser._id }).populate('scheduleAppointment');
        if (!vikramTutor) {
            console.error('❌ Vikram Tutor profile not found');
            return;
        }

        console.log(`👤 Tutor: ${vikramUser.name} (Tutor ID: ${vikramTutor._id})`);

        // 1. Verify Schedule Availability
        const scheduleDoc = vikramTutor.scheduleAppointment;
        if (!scheduleDoc) {
            console.error('❌ Weekly availability NOT found for Vikram');
        } else {
            console.log(`\n📅 Weekly Schedule Availability (ID: ${scheduleDoc._id}):`);
            scheduleDoc.availability.forEach(a => {
                console.log(`- Day: ${a.day}`);
                console.log(`  Slots:`, a.slots);
            });
            console.log(`  Booking Settings:`, JSON.stringify(scheduleDoc.bookingSettings, null, 2));
        }

        // 2. Verify Appointments
        const appointments = await Appointment.find({ tutorId: vikramTutor._id })
            .populate('studentId', 'name email');

        console.log(`\n🤝 Appointments for Vikram (Count: ${appointments.length}):`);
        appointments.forEach(a => {
            console.log(`- Student: ${a.studentId?.name} (${a.studentId?.email})`);
            console.log(`  Date/Time (UTC): ${a.dateTime.toISOString()}`);
            console.log(`  Duration: ${a.duration} minutes`);
            console.log(`  Status: ${a.status}`);
            console.log(`  Notes: "${a.notes}"`);
            console.log(`  Meeting Link: ${a.meetingLink}`);
        });

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('🔄 Disconnected.');
    }
}

run();
