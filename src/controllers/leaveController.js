import Leave from '../models/Leave.js';
import User from '../models/User.js';

// @desc    Apply for a leave
// @route   POST /api/leaves
// @access  Private (Student/Tutor)
export const applyLeave = async (req, res) => {
    try {
        const { startDate, endDate, reason, documents, substituteId } = req.body;

        if (!startDate || !endDate || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Please provide start date, end date, and reason'
            });
        }

        const leave = await Leave.create({
            userId: req.user.id,
            role: req.user.role,
            startDate,
            endDate,
            reason,
            documents: documents || [],
            substituteId: substituteId || null,
        });

        res.status(201).json({
            success: true,
            message: 'Leave application submitted successfully',
            leave
        });
    } catch (error) {
        console.error('Apply leave error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get logged in user's leaves
// @route   GET /api/leaves/my
// @access  Private
export const getMyLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find({ userId: req.user.id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: leaves.length,
            leaves
        });
    } catch (error) {
        console.error('Get my leaves error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get all leaves (Admin)
// @route   GET /api/leaves
// @access  Private/Admin
export const getAllLeaves = async (req, res) => {
    try {
        const { status, role } = req.query;
        let filter = {};

        if (status) filter.status = status;
        if (role) filter.role = role;

        const leaves = await Leave.find(filter)
            .populate('userId', 'name email profileImage')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: leaves.length,
            leaves
        });
    } catch (error) {
        console.error('Get all leaves error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Update leave status (Approve/Reject)
// @route   PUT /api/leaves/:id/status
// @access  Private/Admin
export const updateLeaveStatus = async (req, res) => {
    try {
        const { status, adminComment } = req.body;

        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const leave = await Leave.findById(req.params.id);

        if (!leave) {
            return res.status(404).json({ success: false, message: 'Leave request not found' });
        }

        leave.status = status;
        if (adminComment !== undefined) {
            leave.adminComment = adminComment;
        }

        await leave.save();

        res.status(200).json({
            success: true,
            message: `Leave request ${status}`,
            leave
        });
    } catch (error) {
        console.error('Update leave status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
