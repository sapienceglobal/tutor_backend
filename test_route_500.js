import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'mock-key';
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'mock-key';

// Dynamic imports
const User = (await import('./src/models/User.js')).default;
const Institute = (await import('./src/models/Institute.js')).default;
const { consumeAICredits } = await import('./src/middleware/subscriptionMiddleware.js');
const { draftNotification } = await import('./src/controllers/aiController.js');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tutorapp';

async function run() {
  try {
    console.log('Connecting to', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);

    // Get Tutor Vikram
    const tutorUser = await User.findOne({ email: 'vikram@apexacademy.in' });
    if (!tutorUser) {
      console.log('Tutor Vikram not found');
      return;
    }
    console.log(`Found Tutor: ${tutorUser.name} (${tutorUser.email})`);

    // Get Institute tenant context
    const tenant = await Institute.findById(tutorUser.instituteId);
    if (!tenant) {
      console.log('Institute not found');
      return;
    }
    console.log(`Found Tenant: ${tenant.name}`);

    // Mock Req & Res
    const req = {
      user: tutorUser,
      tenant: tenant,
      body: {
        contextTopic: 'Please check your JEE physics notes.',
        tone: 'Encouraging'
      }
    };

    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        console.log(`\nResponse (Status ${this.statusCode}):`, JSON.stringify(data, null, 2));
      }
    };

    // Run consumeAICredits middleware
    const consumeMiddleware = consumeAICredits(1);
    console.log('\nRunning consumeAICredits middleware...');
    await consumeMiddleware(req, res, async (err) => {
      if (err) {
        console.error('Middleware next() error:', err);
        return;
      }
      console.log('Middleware passed. Running draftNotification...');
      try {
        await draftNotification(req, res);
      } catch (handlerErr) {
        console.error('Handler error caught:', handlerErr);
      }
    });

  } catch (err) {
    console.error('Unexpected error running test:', err);
  } finally {
    await mongoose.disconnect();
  }
}
run();
