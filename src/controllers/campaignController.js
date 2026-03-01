import Campaign from '../models/Campaign.js';
import Lead from '../models/Lead.js';
import nodemailer from 'nodemailer';

// Email transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD,
        },
    });
};

// @desc    Create a campaign
// @route   POST /api/crm/campaigns
// @access  Private/Admin
export const createCampaign = async (req, res) => {
    try {
        const { title, type, subject, body, recipientFilter, scheduledAt } = req.body;

        if (!title || !type || !body) {
            return res.status(400).json({ success: false, message: 'Title, type, and body are required' });
        }

        // Get recipients based on filter
        const filter = recipientFilter || {};
        const leads = await Lead.find(filter);

        const recipients = leads.map(lead => ({
            leadId: lead._id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            status: 'pending',
        }));

        const campaign = await Campaign.create({
            title,
            type,
            subject,
            body,
            recipients,
            scheduledAt: scheduledAt || null,
            status: scheduledAt ? 'scheduled' : 'draft',
            createdBy: req.user.id,
        });

        res.status(201).json({ success: true, data: campaign });
    } catch (error) {
        console.error('Create campaign error:', error);
        res.status(500).json({ success: false, message: 'Failed to create campaign' });
    }
};

// @desc    Send email campaign
// @route   POST /api/crm/campaigns/:id/send
// @access  Private/Admin
export const sendCampaign = async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

        if (campaign.status === 'sent') {
            return res.status(400).json({ success: false, message: 'Campaign already sent' });
        }

        if (campaign.type === 'email') {
            const transporter = createTransporter();
            let sentCount = 0, failedCount = 0;

            for (const recipient of campaign.recipients) {
                try {
                    await transporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to: recipient.email,
                        subject: campaign.subject || campaign.title,
                        html: campaign.body.replace('{{name}}', recipient.name || 'Student'),
                    });
                    recipient.status = 'sent';
                    recipient.sentAt = new Date();
                    sentCount++;
                } catch (err) {
                    recipient.status = 'failed';
                    failedCount++;
                    console.error(`Failed to send to ${recipient.email}:`, err.message);
                }
            }

            campaign.totalSent = sentCount;
            campaign.totalFailed = failedCount;
            campaign.status = 'sent';
            campaign.sentAt = new Date();
            await campaign.save();

            res.status(200).json({
                success: true,
                message: `Campaign sent: ${sentCount} delivered, ${failedCount} failed`,
                data: { totalSent: sentCount, totalFailed: failedCount },
            });
        } else if (campaign.type === 'sms') {
            // SMS integration placeholder — requires Twilio/MSG91 setup
            campaign.status = 'sent';
            campaign.sentAt = new Date();
            campaign.totalSent = campaign.recipients.length;
            await campaign.save();

            res.status(200).json({
                success: true,
                message: 'SMS campaign queued (integration required for delivery)',
                data: { totalQueued: campaign.recipients.length },
            });
        } else if (campaign.type === 'whatsapp') {
            // WhatsApp integration placeholder — requires WhatsApp Business API
            campaign.status = 'sent';
            campaign.sentAt = new Date();
            campaign.totalSent = campaign.recipients.length;
            await campaign.save();

            res.status(200).json({
                success: true,
                message: 'WhatsApp campaign queued (Business API integration required)',
                data: { totalQueued: campaign.recipients.length },
            });
        }
    } catch (error) {
        console.error('Send campaign error:', error);
        res.status(500).json({ success: false, message: 'Failed to send campaign' });
    }
};

// @desc    Get all campaigns
// @route   GET /api/crm/campaigns
// @access  Private/Admin
export const getCampaigns = async (req, res) => {
    try {
        const campaigns = await Campaign.find()
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, count: campaigns.length, data: campaigns });
    } catch (error) {
        console.error('Get campaigns error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch campaigns' });
    }
};

// @desc    Get campaign by ID
// @route   GET /api/crm/campaigns/:id
// @access  Private/Admin
export const getCampaignById = async (req, res) => {
    try {
        const campaign = await Campaign.findById(req.params.id)
            .populate('createdBy', 'name')
            .populate('recipients.leadId', 'name email phone');

        if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

        res.status(200).json({ success: true, data: campaign });
    } catch (error) {
        console.error('Get campaign error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch campaign' });
    }
};

// @desc    Update lead conversion status
// @route   PATCH /api/crm/leads/:id/conversion
// @access  Private/Admin
export const updateLeadConversion = async (req, res) => {
    try {
        const { conversionStatus, conversionValue } = req.body;
        const lead = await Lead.findById(req.params.id);

        if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

        if (conversionStatus) {
            lead.conversionStatus = conversionStatus;
            if (conversionStatus !== 'none' && !lead.convertedAt) {
                lead.convertedAt = new Date();
            }
        }
        if (conversionValue !== undefined) lead.conversionValue = conversionValue;

        await lead.save();

        res.status(200).json({ success: true, data: lead });
    } catch (error) {
        console.error('Update conversion error:', error);
        res.status(500).json({ success: false, message: 'Failed to update conversion' });
    }
};
