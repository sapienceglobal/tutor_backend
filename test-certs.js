import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Enrollment from './src/models/Enrollment.js';
import Certificate from './src/models/Certificate.js';
import User from './src/models/User.js';
import Course from './src/models/Course.js';

dotenv.config({ path: './.env' });

async function checkLogic() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        const student = await User.findOne({ role: 'student' });
        const course = await Course.findOne();

        if (!student || !course) {
            console.log("Need a student and course to test.");
            process.exit();
        }

        console.log(`Student: ${student.name}`);
        console.log(`Course: ${course.title}`);

        // Create or find enrollment
        let enrollment = await Enrollment.findOne({ studentId: student._id, courseId: course._id });
        if (!enrollment) {
            console.log("Creating new enrollment with 100% progress...");
            enrollment = await Enrollment.create({
                studentId: student._id,
                courseId: course._id,
                progress: { percentage: 100 },
                status: 'completed'
            });
        } else {
            console.log("Updating existing enrollment to 100%...");
            enrollment.progress.percentage = 100;
            enrollment.status = 'completed';
            await enrollment.save();
        }

        const count = await Certificate.countDocuments({ studentId: student._id });
        console.log(`Certificates found for student: ${count}`);

        console.log('Verifying Course Tutor Population...');
        const populatedCourse = await Course.findById(course._id).populate('tutorId');
        console.log(`Tutor ID valid: ${!!populatedCourse.tutorId}`);

        console.log("Ready for manual UI testing.");

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkLogic();
