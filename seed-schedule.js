import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tutor from './src/models/Tutor.js';
import ScheduleAppointment from './src/models/Appointment_Schedule.js';

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tutor-app');
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};

const seedSchedule = async () => {
    try {
        const tutors = await Tutor.find();
        if (tutors.length === 0) {
            console.log('⚠️ No tutors found. Please run test-data.js first.');
            process.exit(1);
        }

        console.log(`Found ${tutors.length} tutors. Updating schedules...`);

        for (const tutor of tutors) {
            // Check if schedule already exists and delete it to start fresh
            if (tutor.scheduleAppointment) {
                await ScheduleAppointment.findByIdAndDelete(tutor.scheduleAppointment);
            }

            // Create new schedule
            const schedule = await ScheduleAppointment.create({
                availability: [
                    { day: 'Monday', slots: ['09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00'] },
                    { day: 'Tuesday', slots: ['09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00'] },
                    { day: 'Wednesday', slots: ['09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00'] },
                    { day: 'Thursday', slots: ['09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00'] },
                    { day: 'Friday', slots: ['09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00'] },
                    { day: 'Saturday', slots: ['10:00-11:00', '11:00-12:00'] },
                ],
                bookingSettings: {
                    minAdvanceHours: 24,
                    maxAdvanceDays: 30,
                    allowSameDayBooking: false,
                    slotCapacity: 1
                }
            });

            tutor.scheduleAppointment = schedule._id;
            await tutor.save();
            console.log(`✅ Updated schedule for tutor: ${tutor.userId} (${tutor._id})`);
        }

        console.log('🎉 All tutor schedules updated!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding schedule:', error);
        process.exit(1);
    }
};

connectDB().then(seedSchedule);
