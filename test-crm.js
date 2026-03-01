import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Lead from './src/models/Lead.js';

dotenv.config({ path: './.env' });

async function seedLead() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB.');

        console.log('Clearing old test leads...');
        await Lead.deleteMany({ email: 'testlead@sapience.com' });

        console.log('Creating a test lead...');
        const newLead = await Lead.create({
            name: 'Test Setup Lead',
            email: 'testlead@sapience.com',
            phone: '1234567890',
            message: 'I would like to know more about the data science course.',
            status: 'new'
        });

        console.log('Test lead created successfully:', newLead._id);

    } catch (err) {
        console.error('Error seeding lead:', err);
    } finally {
        mongoose.connection.close();
    }
}

seedLead();
