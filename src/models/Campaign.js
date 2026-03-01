import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Campaign title is required'],
        trim: true,
    },
    type: {
        type: String,
        enum: ['email', 'sms', 'whatsapp'],
        required: true,
    },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'sent', 'failed'],
        default: 'draft',
    },
    // Content
    subject: String, // for email
    body: {
        type: String,
        required: true,
    },
    // Recipients
    recipients: [{
        leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
        name: String,
        email: String,
        phone: String,
        status: { type: String, enum: ['pending', 'sent', 'failed', 'opened', 'clicked'], default: 'pending' },
        sentAt: Date,
    }],
    // Stats
    totalSent: { type: Number, default: 0 },
    totalOpened: { type: Number, default: 0 },
    totalClicked: { type: Number, default: 0 },
    totalFailed: { type: Number, default: 0 },
    // Schedule
    scheduledAt: Date,
    sentAt: Date,
    // Creator
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true });

export default mongoose.model('Campaign', campaignSchema);
