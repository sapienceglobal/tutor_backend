import Report from '../models/Report.js';

export const createReport = async (req, res) => {
    try {
        const { targetType, targetId, reason, description } = req.body;

        const report = new Report({
            reporter: req.user.id, // Assumes auth middleware
            targetType,
            targetId,
            reason,
            description
        });

        await report.save();

        res.status(201).json({
            success: true,
            message: 'Report submitted successfully. We will review it shortly.',
            data: report
        });
    } catch (error) {
        console.error('Create Report Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit report'
        });
    }
};
