import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';

// @desc    Get global assignments and submission stats (God View)
// @route   GET /api/superadmin/assignments
// @access  Private/Superadmin
export const getGlobalAssignments = async (req, res) => {
    try {
        const { status, search } = req.query;

        // 1. Build Query
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        // 2. Fetch Assignments (Latest 50 for dashboard performance)
        const assignments = await Assignment.find(query)
            .populate('courseId', 'title')
            .populate('instituteId', 'name')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean(); // Use lean for faster execution since we are attaching new properties

        // 3. Attach Live Submission Stats to each Assignment
        const assignmentsWithStats = await Promise.all(assignments.map(async (asg) => {
            const totalSubmissions = await Submission.countDocuments({ assignmentId: asg._id });
            const pendingGrading = await Submission.countDocuments({ assignmentId: asg._id, status: 'submitted' });
            const gradedCount = await Submission.countDocuments({ assignmentId: asg._id, status: 'graded' });
            
            return {
                ...asg,
                stats: {
                    totalSubmissions,
                    pendingGrading,
                    gradedCount
                }
            };
        }));

        // 4. Calculate Global KPIs
        const totalAssignments = await Assignment.countDocuments();
        const activeAssignments = await Assignment.countDocuments({ status: 'published' });
        const totalGlobalSubmissions = await Submission.countDocuments();
        const globalPendingGrading = await Submission.countDocuments({ status: 'submitted' });

        res.status(200).json({
            success: true,
            data: {
                assignments: assignmentsWithStats,
                kpis: {
                    totalAssignments,
                    activeAssignments,
                    totalGlobalSubmissions,
                    globalPendingGrading
                }
            }
        });
    } catch (error) {
        console.error('Superadmin Fetch Assignments Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch assignments' });
    }
};