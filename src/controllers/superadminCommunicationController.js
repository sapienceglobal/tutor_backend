import Notification from '../models/Notification.js';
import Campaign from '../models/Campaign.js';
import User from '../models/User.js';

// @desc    Get Communication KPIs & Campaign History
// @route   GET /api/superadmin/communication
// @access  Private/Superadmin
export const getCommunicationData = async (req, res) => {
    try {
        const campaigns = await Campaign.find()
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        // Calculate KPIs
        const totalCampaigns = campaigns.length;
        const totalSent = campaigns.reduce((acc, curr) => acc + curr.totalSent, 0);
        const totalOpened = campaigns.reduce((acc, curr) => acc + curr.totalOpened, 0);
        
        // Approximate open rate
        const avgOpenRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : 0;

        res.status(200).json({
            success: true,
            data: {
                campaigns,
                kpis: {
                    totalCampaigns,
                    totalSent,
                    avgOpenRate
                }
            }
        });
    } catch (error) {
        console.error('Fetch Communication Data Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch communication data' });
    }
};

// @desc    Send Global In-App Announcement
// @route   POST /api/superadmin/communication/announcement
// @access  Private/Superadmin
export const sendGlobalAnnouncement = async (req, res) => {
    try {
        const { targetAudience, title, message } = req.body;
        // targetAudience can be 'all', 'students', or 'tutors'

        let userQuery = {};
        if (targetAudience === 'students') userQuery.role = 'student';
        if (targetAudience === 'tutors') userQuery.role = 'tutor';
        // if 'all', query remains empty to fetch everyone

        // Select only _id to save memory
        const users = await User.find(userQuery).select('_id');
        
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'No users found for this audience.' });
        }

        // Prepare bulk notification array
        const notifications = users.map(user => ({
            userId: user._id,
            type: 'announcement', // Exact match with your enum
            title,
            message,
            isRead: false
        }));

        // Insert all at once for high performance
        await Notification.insertMany(notifications);

        res.status(200).json({
            success: true,
            message: `Announcement sent successfully to ${users.length} users.`,
        });
    } catch (error) {
        console.error('Send Announcement Error:', error);
        res.status(500).json({ success: false, message: 'Failed to send announcement' });
    }
};

// @desc    Create a new Marketing Campaign (Draft/Scheduled)
// @route   POST /api/superadmin/communication/campaign
// @access  Private/Superadmin
export const createCampaign = async (req, res) => {
    try {
        const { title, type, subject, body, status } = req.body;

        const newCampaign = await Campaign.create({
            title,
            type,
            subject,
            body,
            status: status || 'draft',
            createdBy: req.user._id, // Assuming req.user is populated by protect middleware
            totalSent: 0
        });

        // 🌟 NOTE: Actual sending logic (NodeMailer, Twilio, WhatsApp Cloud API) 
        // would trigger here if status === 'sent' or handled by a cron job for 'scheduled'.

        res.status(201).json({
            success: true,
            message: `Campaign '${title}' saved as ${newCampaign.status}`,
            data: newCampaign
        });
    } catch (error) {
        console.error('Create Campaign Error:', error);
        res.status(500).json({ success: false, message: 'Failed to create campaign' });
    }
};