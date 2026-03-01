import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Page from './src/models/Page.js';
import Blog from './src/models/Blog.js';
import User from './src/models/User.js';

dotenv.config({ path: './.env' });

async function seedCMS() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB.');

        console.log('Finding a superadmin user...');
        const admin = await User.findOne({ role: 'superadmin' });
        if (!admin) {
            console.error('No superadmin found! Cannot seed author.');
            process.exit(1);
        }

        console.log('Clearing old test CMS stuff...');
        await Page.deleteMany({ slug: 'privacy-test' });
        await Blog.deleteMany({ slug: 'welcome-test' });

        console.log('Creating a test Page...');
        const page = await Page.create({
            title: 'Privacy Policy Validation',
            slug: 'privacy-test',
            content: '<h1>Privacy is paramount</h1><p>This is a validation test for the CMS Dynamic Pages module.</p>',
            isPublished: true,
            seoMeta: { title: 'Privacy | Sapience', description: 'Test privacy page', keywords: 'privacy, security' },
            author: admin._id
        });
        console.log('Page created:', page._id);

        console.log('Creating a test Blog...');
        const blog = await Blog.create({
            title: 'Welcome to the New Sapience Platform!',
            slug: 'welcome-test',
            excerpt: 'We just launched the ultimate learning management system.',
            content: '<h1>Hello World</h1><p>We are thrilled to announce our new engine.</p>',
            isPublished: true,
            thumbnail: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=1000&auto=format&fit=crop',
            tags: ['Announcement', 'Platform'],
            seoMeta: { title: 'Welcome | Blog', description: 'Welcome announcement', keywords: 'welcome, launch' },
            author: admin._id
        });
        console.log('Blog created:', blog._id);

    } catch (err) {
        console.error('Error seeding CMS:', err);
    } finally {
        mongoose.connection.close();
    }
}

seedCMS();
