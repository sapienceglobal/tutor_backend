import cron from 'node-cron';
import User from '../models/User.js';
// 🌟 Ensure you have a Notification model, or adjust this import based on your DB
import Notification from '../models/Notification.js'; 
import { generateDailyAIReport } from '../controllers/aiController.js';

export const initAICronJobs = () => {
    console.log("⏰ AI Cron Agent Initialized.");

    // 🚀 TESTING KE LIYE: Abhi ye har 2 minute mein chalega (*/2 * * * *). 
    // Jab test successful ho jaye, toh isko '0 9 * * *' kar dena (Roz subah 9 baje ke liye).
    cron.schedule('0 9 * * *', async () => {
        console.log('🤖 Triggering Proactive AI Report...');
        
        const report = await generateDailyAIReport();
        if (!report) return;

        // Saare Superadmins/Admins ko dhundho
        const superadmins = await User.find({ role: { $in: ['admin', 'superadmin'] } });
        if (superadmins.length === 0) return;

        // Unko Notification bhej do
      const notifications = superadmins.map(admin => ({
            userId: admin._id,
            title: "🧠 AI Morning Briefing",
            message: report,
            type: 'announcement', // ✅ Isko 'announcement' ya 'alert' kar do
            isRead: false
        }));

        await Notification.insertMany(notifications);
        console.log('✅ Daily AI Insight saved to Notifications!');
    });
};