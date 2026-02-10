
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Tutor from './models/Tutor.js';
import Category from './models/Category.js';
import Course from './models/Course.js'; // Optional: clear courses too if needed

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
        await connectDB();

        console.log('🗑️  Clearing database...');
        await User.deleteMany({});
        await Tutor.deleteMany({});
        await Category.deleteMany({});
        // await Course.deleteMany({}); // Uncomment if you want to clear courses too

        console.log('🌱 Seeding Categories...');
        const categories = await Category.insertMany([
            { name: 'Mathematics', icon: '📐', description: 'Algebra, Calculus, Geometry, and more' },
            { name: 'Physics', icon: '⚛️', description: 'Mechanics, Thermodynamics, Quantum Physics' },
            { name: 'Chemistry', icon: '🧪', description: 'Organic, Inorganic, and Physical Chemistry' },
            { name: 'Computer Science', icon: '💻', description: 'Programming, Algorithms, Web Development' },
            { name: 'English', icon: '📚', description: 'Literature, Grammar, Writing Skills' },
            { name: 'Music', icon: '🎵', description: 'Theory, Instruments, Vocals' }
        ]);

        console.log('🌱 Seeding Tutors...');
        const hashedPassword = await bcrypt.hash('password123', 10);

        const tutorsData = [
            {
                name: 'John Doe',
                email: 'john@example.com',
                phone: '1234567890',
                title: 'Senior Math Tutor',
                bio: 'Over 10 years of experience teaching Algebra and Calculus.',
                categoryName: 'Mathematics',
                hourlyRate: 50,
                experience: 10,
                location: 'New York, USA',
                profileImage: 'https://randomuser.me/api/portraits/men/1.jpg'
            },
            {
                name: 'Jane Smith',
                email: 'jane@example.com',
                phone: '0987654321',
                title: 'Physics Expert',
                bio: 'Ph.D. in Physics. Passionate about making complex concepts simple.',
                categoryName: 'Physics',
                hourlyRate: 60,
                experience: 8,
                location: 'London, UK',
                profileImage: 'https://randomuser.me/api/portraits/women/2.jpg'
            },
            {
                name: 'Robert Brown',
                email: 'robert@example.com',
                phone: '1122334455',
                title: 'Chemistry Guru',
                bio: 'Specializing in Organic Chemistry and competitive exam prep.',
                categoryName: 'Chemistry',
                hourlyRate: 45,
                experience: 12,
                location: 'Toronto, Canada',
                profileImage: 'https://randomuser.me/api/portraits/men/3.jpg'
            },
            {
                name: 'Emily Davis',
                email: 'emily@example.com',
                phone: '5566778899',
                title: 'Full Stack Developer',
                bio: 'Professional software engineer teaching Web Dev and Python.',
                categoryName: 'Computer Science',
                hourlyRate: 75,
                experience: 5,
                location: 'San Francisco, USA',
                profileImage: 'https://randomuser.me/api/portraits/women/4.jpg'
            },
            {
                name: 'Michael Wilson',
                email: 'michael@example.com',
                phone: '6677889900',
                title: 'English Literature Prof',
                bio: 'Helping students improve their writing and analytical skills.',
                categoryName: 'English',
                hourlyRate: 40,
                experience: 20,
                location: 'Sydney, Australia',
                profileImage: 'https://randomuser.me/api/portraits/men/5.jpg'
            },
            {
                name: 'Sarah Johnson',
                email: 'sarah@example.com',
                phone: '9988776655',
                title: 'Piano & Music Theory',
                bio: 'Learn music theory and piano from a certified instructor.',
                categoryName: 'Music',
                hourlyRate: 55,
                experience: 7,
                location: 'Berlin, Germany',
                profileImage: 'https://randomuser.me/api/portraits/women/6.jpg'
            }
        ];

        for (const data of tutorsData) {
            // 1. Create User
            const user = await User.create({
                name: data.name,
                email: data.email,
                password: hashedPassword, // Manually hashed since we bypass pre-save if using insertMany, but here using create so pre-save might run double if not careful. 
                // Wait, User model doesn't have pre-save hash hook in the file I read! 
                // I checked User.js and it did NOT show a pre-save hook for password hashing.
                // It only had comparePassword method.
                // So I MUST hash it here.
                phone: data.phone,
                role: 'tutor',
                profileImage: data.profileImage,
                isVerified: true
            });

            // 2. Find Category
            const category = categories.find(c => c.name === data.categoryName);

            // 3. Create Tutor Profile
            await Tutor.create({
                userId: user._id,
                categoryId: category._id,
                hourlyRate: data.hourlyRate,
                experience: data.experience,
                bio: data.bio,
                title: data.title,
                location: data.location,
                isVerified: true,
                rating: (4 + Math.random()).toFixed(1), // Random rating 4.0 - 5.0
                studentsCount: Math.floor(Math.random() * 500) + 50 // Random students
            });

            // Update Category count
            await Category.findByIdAndUpdate(category._id, { $inc: { tutorCount: 1 } });
        }

        console.log('✅ Database Seeded Successfully!');
        console.log('🔑 Password for all users: password123');
        process.exit();
    } catch (error) {
        console.error('❌ Seeding Error:', error);
        process.exit(1);
    }
};

seedData();
