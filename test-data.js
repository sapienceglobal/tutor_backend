import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';
import Category from './src/models/Category.js';
import Tutor from './src/models/Tutor.js';
import bcrypt from 'bcryptjs';

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

const seedData = async () => {
    try {
        // Clear existing data
        await User.deleteMany({});
        await Category.deleteMany({});
        await Tutor.deleteMany({});
        console.log('🗑️  Cleared existing data');

        // Create categories
        const categories = await Category.insertMany([
            { name: 'English', icon: '📚', description: 'Learn English language and literature' },
            { name: 'Maths', icon: '🔢', description: 'Master mathematics and problem solving' },
            { name: 'Science', icon: '🔬', description: 'Explore physics, chemistry, and biology' },
            { name: 'Physics', icon: '⚛️', description: 'Understand the laws of physics' },
            { name: 'Chemistry', icon: '🧪', description: 'Study chemical reactions and elements' },
            { name: 'Biology', icon: '🧬', description: 'Learn about life and living organisms' },
            { name: 'Computer', icon: '💻', description: 'Programming and computer science' },
            { name: 'History', icon: '📜', description: 'Study world history and events' },
        ]);
        console.log('✅ Categories created');

        // Create tutor users
        const hashedPassword = await bcrypt.hash('password123', 10);

        const tutorUsers = await User.insertMany([
            {
                name: 'Robert Smith',
                email: 'robert@example.com',
                password: hashedPassword,
                phone: '+91-9876543210',
                role: 'tutor',
                profileImage: 'https://randomuser.me/api/portraits/men/1.jpg',
            },
            {
                name: 'Sarah Johnson',
                email: 'sarah@example.com',
                password: hashedPassword,
                phone: '+91-9876543211',
                role: 'tutor',
                profileImage: 'https://randomuser.me/api/portraits/women/1.jpg',
            },
            {
                name: 'Michael Brown',
                email: 'michael@example.com',
                password: hashedPassword,
                phone: '+91-9876543212',
                role: 'tutor',
                profileImage: 'https://randomuser.me/api/portraits/men/2.jpg',
            },
            {
                name: 'Emily Davis',
                email: 'emily@example.com',
                password: hashedPassword,
                phone: '+91-9876543213',
                role: 'tutor',
                profileImage: 'https://randomuser.me/api/portraits/women/2.jpg',
            },
            {
                name: 'David Wilson',
                email: 'david@example.com',
                password: hashedPassword,
                phone: '+91-9876543214',
                role: 'tutor',
                profileImage: 'https://randomuser.me/api/portraits/men/3.jpg',
            },
        ]);
        console.log('✅ Tutor users created');

        // Create student user
        await User.create({
            name: 'Test Student',
            email: 'student@example.com',
            password: hashedPassword,
            phone: '+91-9876543220',
            role: 'student',
        });
        console.log('✅ Student user created');

        // Create tutors
        const tutors = await Tutor.insertMany([
            {
                userId: tutorUsers[0]._id,
                categoryId: categories[0]._id, // English
                hourlyRate: 500,
                experience: 5,
                rating: 4.8,
                studentsCount: 120,
                subjects: ['Grammar', 'Literature', 'Writing'],
                bio: 'Experienced English teacher with 5 years of teaching experience. Specialized in IELTS and TOEFL preparation.',
                isVerified: true,
            },
            {
                userId: tutorUsers[1]._id,
                categoryId: categories[1]._id, // Maths
                hourlyRate: 600,
                experience: 7,
                rating: 4.9,
                studentsCount: 150,
                subjects: ['Algebra', 'Calculus', 'Geometry'],
                bio: 'Mathematics expert helping students excel in competitive exams. IIT graduate with proven track record.',
                isVerified: true,
            },
            {
                userId: tutorUsers[2]._id,
                categoryId: categories[3]._id, // Physics
                hourlyRate: 550,
                experience: 6,
                rating: 4.7,
                studentsCount: 100,
                subjects: ['Mechanics', 'Thermodynamics', 'Electromagnetism'],
                bio: 'Physics tutor with passion for making complex concepts simple and understandable.',
                isVerified: true,
            },
            {
                userId: tutorUsers[3]._id,
                categoryId: categories[6]._id, // Computer
                hourlyRate: 700,
                experience: 8,
                rating: 4.9,
                studentsCount: 200,
                subjects: ['Python', 'Java', 'Web Development'],
                bio: 'Software engineer turned educator. Teaching programming and computer science fundamentals.',
                isVerified: true,
            },
            {
                userId: tutorUsers[4]._id,
                categoryId: categories[4]._id, // Chemistry
                hourlyRate: 500,
                experience: 4,
                rating: 4.6,
                studentsCount: 80,
                subjects: ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry'],
                bio: 'Chemistry expert with hands-on practical knowledge. Making chemistry fun and easy to understand.',
                isVerified: true,
            },
        ]);
        console.log('✅ Tutors created');

        // Update category tutor counts
        for (const category of categories) {
            const count = await Tutor.countDocuments({ categoryId: category._id });
            category.tutorCount = count;
            await category.save();
        }
        console.log('✅ Category counts updated');

        console.log('\n🎉 Sample data created successfully!');
        console.log('\n📝 Login Credentials:');
        console.log('Student: student@example.com / password123');
        console.log('Tutors: robert@example.com / password123 (and others)');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding data:', error);
        process.exit(1);
    }
};

connectDB().then(seedData);
