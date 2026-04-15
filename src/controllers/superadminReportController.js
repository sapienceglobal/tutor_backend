import Report from '../models/Report.js';
import mongoose from 'mongoose';

// @desc    Get all abuse reports & KPIs (God View)
// @route   GET /api/superadmin/reports
// @access  Private/Superadmin
export const getGlobalReports = async (req, res) => {
    try {
        const { status, search } = req.query;

        let query = {};
        if (status && status !== 'all') {
            // Mongoose is case-sensitive, match your Schema's exact enum casing
            const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);
            query.status = formattedStatus;
        }

        // Fetch reports and populate the reporter
        const reports = await Report.find(query)
            .populate('reporter', 'name email profileImage')
            .sort({ createdAt: -1 })
            .lean();

        // 🌟 Magic: Safely try to fetch the Target Names without assuming exact model strictness
        const enrichedReports = await Promise.all(reports.map(async (report) => {
            let targetName = 'Unknown Target';
            
            try {
                if (report.targetType === 'Course' && mongoose.models.Course) {
                    const course = await mongoose.models.Course.findById(report.targetId).select('title').lean();
                    if (course) targetName = course.title;
                } else if (report.targetType === 'Tutor' && mongoose.models.User) {
                    const tutor = await mongoose.models.User.findById(report.targetId).select('name').lean();
                    if (tutor) targetName = tutor.name;
                } else if (report.targetType === 'Review' && mongoose.models.Review) {
                    const review = await mongoose.models.Review.findById(report.targetId).select('comment').lean();
                    if (review) targetName = review.comment.substring(0, 30) + '...';
                }
            } catch (e) {
                // Ignore lookup failures if the target was deleted
            }

            return { ...report, targetName };
        }));

        // Calculate Real KPIs
        const totalReports = await Report.countDocuments();
        const pendingCount = await Report.countDocuments({ status: 'Pending' });
        const reviewedCount = await Report.countDocuments({ status: 'Reviewed' });
        const resolvedCount = await Report.countDocuments({ status: 'Resolved' });
        const dismissedCount = await Report.countDocuments({ status: 'Dismissed' });

        res.status(200).json({
            success: true,
            data: {
                reports: enrichedReports,
                kpis: { totalReports, pendingCount, reviewedCount, resolvedCount, dismissedCount }
            }
        });
    } catch (error) {
        console.error('Superadmin Fetch Reports Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch global reports' });
    }
};

// @desc    Update Report Status
// @route   PATCH /api/superadmin/reports/:id/status
// @access  Private/Superadmin
export const updateReportStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['Pending', 'Reviewed', 'Resolved', 'Dismissed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status provided' });
        }

        const report = await Report.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        );

        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

        res.status(200).json({
            success: true,
            message: `Report status updated to ${status}`,
            data: report
        });
    } catch (error) {
        console.error('Update Report Status Error:', error);
        res.status(500).json({ success: false, message: 'Failed to update report status' });
    }
};