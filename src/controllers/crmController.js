import Lead from '../models/Lead.js';
import User from '../models/User.js';

// @desc    Capture a new lead from contact form/landing page
// @route   POST /api/crm/leads
// @access  Public
export const captureLead = async (req, res) => {
    try {
        const { name, email, phone, courseOfInterest, message, source } = req.body;

        const newLead = await Lead.create({
            name,
            email,
            phone,
            courseOfInterest: courseOfInterest || null,
            message,
            source: source || 'website'
        });

        res.status(201).json({
            success: true,
            data: newLead,
            message: 'Thank you! We will get back to you shortly.'
        });
    } catch (error) {
        console.error('Error capturing lead:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get all leads
// @route   GET /api/crm/leads
// @access  Private/Admin
export const getLeads = async (req, res) => {
    try {
        const query = {};

        // Optional filtering by counselor
        if (req.query.assignedCounselor) {
            query.assignedCounselor = req.query.assignedCounselor;
        }

        // Optional filtering by status
        if (req.query.status) {
            query.status = req.query.status;
        }

        const leads = await Lead.find(query)
            .populate('courseOfInterest', 'title')
            .populate('assignedCounselor', 'name email')
            .populate('notes.addedBy', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: leads.length,
            data: leads
        });
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update a lead (status, counselor assignment)
// @route   PUT /api/crm/leads/:id
// @access  Private/Admin
export const updateLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assignedCounselor } = req.body;

        const lead = await Lead.findById(id);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        if (status) lead.status = status;
        if (assignedCounselor !== undefined) lead.assignedCounselor = assignedCounselor;

        await lead.save();

        const updatedLead = await Lead.findById(id)
            .populate('courseOfInterest', 'title')
            .populate('assignedCounselor', 'name email')
            .populate('notes.addedBy', 'name');

        res.status(200).json({
            success: true,
            data: updatedLead
        });
    } catch (error) {
        console.error('Error updating lead:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Add a note to a lead
// @route   POST /api/crm/leads/:id/notes
// @access  Private/Admin
export const addLeadNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ success: false, message: 'Note text is required' });
        }

        const lead = await Lead.findById(id);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        lead.notes.push({
            text,
            addedBy: req.user.id
        });

        await lead.save();

        const updatedLead = await Lead.findById(id)
            .populate('courseOfInterest', 'title')
            .populate('assignedCounselor', 'name email')
            .populate('notes.addedBy', 'name');

        res.status(200).json({
            success: true,
            data: updatedLead
        });

    } catch (error) {
        console.error('Error adding note to lead:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get Counselors List
// @route   GET /api/crm/counselors
// @access  Private/Admin
export const getCounselors = async (req, res) => {
    try {
        // Counselors are admins/superadmins for now
        const counselors = await User.find({ role: { $in: ['admin', 'superadmin'] } })
            .select('name email role');

        res.status(200).json({
            success: true,
            data: counselors
        });
    } catch (error) {
        console.error('Error fetching counselors:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}
