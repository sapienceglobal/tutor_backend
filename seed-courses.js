import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Course from './src/models/Course.js';
import Lesson from './src/models/Lesson.js';
import Category from './src/models/Category.js';
import Tutor from './src/models/Tutor.js';

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        process.exit(1);
    }
};

const seedCourses = async () => {
    try {
        // Get existing categories and tutors
        const categories = await Category.find();
        const tutors = await Tutor.find();

        if (categories.length === 0 || tutors.length === 0) {
            console.log('⚠️  Please run test-data.js first to create categories and tutors');
            process.exit(1);
        }

        // Clear existing courses and lessons
        await Course.deleteMany({});
        await Lesson.deleteMany({});
        console.log('🗑️  Cleared existing courses and lessons');

        // Create sample courses
        const courses = [];

        for (let i = 0; i < 5; i++) {
            const category = categories[i % categories.length];
            const tutor = tutors[i % tutors.length];

            const course = await Course.create({
                title: `${category.name} Masterclass ${i + 1}`,
                description: `Complete ${category.name} course covering all fundamentals and advanced concepts. Learn from industry experts with hands-on projects.`,
                thumbnail: `https://picsum.photos/400/250?random=${i}`,
                categoryId: category._id,
                tutorId: tutor._id,
                price: i % 2 === 0 ? 0 : (i + 1) * 500,
                isFree: i % 2 === 0,
                level: ['beginner', 'intermediate', 'advanced'][i % 3],
                duration: (i + 1) * 10,
                language: 'English',
                modules: [
                    {
                        title: 'Introduction',
                        description: 'Getting started with the basics',
                        order: 0,
                    },
                    {
                        title: 'Advanced Concepts',
                        description: 'Deep dive into advanced topics',
                        order: 1,
                    },
                ],
                enrolledCount: Math.floor(Math.random() * 200) + 50,
                rating: (Math.random() * 1.5 + 3.5).toFixed(1),
                reviewCount: Math.floor(Math.random() * 100) + 10,
                status: 'published',
                requirements: [
                    'Basic understanding of the subject',
                    'Computer with internet connection',
                    'Willingness to learn',
                ],
                whatYouWillLearn: [
                    'Master core concepts',
                    'Build real-world projects',
                    'Get industry-ready skills',
                    'Understand best practices',
                ],
            });

            courses.push(course);

            // Create lessons for each module
            for (let moduleIndex = 0; moduleIndex < course.modules.length; moduleIndex++) {
                const module = course.modules[moduleIndex];
                console.log("MODULE ID ->", module._id);  // debugging


                for (let lessonIndex = 0; lessonIndex < 3; lessonIndex++) {
                    await Lesson.create({
                        courseId: course._id,
                        moduleId: module._id,
                        title: `Lesson ${lessonIndex + 1}: ${module.title}`,
                        description: `Detailed explanation of ${module.title} concepts`,
                        type: 'video',
                        content: {
                            videoUrl: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`,
                            duration: 600 + lessonIndex * 300,
                            attachments: [],
                        },
                        order: lessonIndex,
                        isFree: lessonIndex === 0, // First lesson is free
                        isPublished: true,
                    });
                }
            }

            console.log(`✅ Created course: ${course.title}`);
        }

        console.log(`\n🎉 Created ${courses.length} courses with lessons!`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding courses:', error);
        process.exit(1);
    }
};

connectDB().then(seedCourses);