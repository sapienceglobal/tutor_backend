import Batch from '../models/Batch.js';

// @desc    Get all batches globally (God View)
// @route   GET /api/superadmin/batches
// @access  Private/Superadmin
export const getGlobalBatches = async (req, res) => {
    try {
        const { status, search } = req.query;

        // Build query
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        // Fetch batches with relations
        let batches = await Batch.find(query)
            .populate('courseId', 'title thumbnail')
            .populate({
                path: 'tutorId',
                populate: {
                    path: 'userId',
                    select: 'name email profileImage'
                }
            })
            .populate('instituteId', 'name subdomain')
            .sort({ createdAt: -1 });

        // Map userId fields to tutorId to match frontend expectations
        batches = batches.map(batch => {
            const batchObj = batch.toObject();
            if (batchObj.tutorId && batchObj.tutorId.userId) {
                batchObj.tutorId.name = batchObj.tutorId.userId.name;
                batchObj.tutorId.email = batchObj.tutorId.userId.email;
                batchObj.tutorId.profileImage = batchObj.tutorId.userId.profileImage;
            }
            return batchObj;
        });

        // ─── Calculate Global KPIs ───
        const totalBatches = await Batch.countDocuments();
        const activeBatches = await Batch.countDocuments({ status: 'active' });
        const completedBatches = await Batch.countDocuments({ status: 'completed' });
        
        // Aggregate to get average students per batch and total enrolled students in batches
        const studentStats = await Batch.aggregate([
            { 
                $project: { 
                    studentCount: { $size: { $ifNull: ["$students", []] } } 
                } 
            },
            { 
                $group: { 
                    _id: null, 
                    avgStudents: { $avg: "$studentCount" },
                    totalStudents: { $sum: "$studentCount" }
                } 
            }
        ]);

        const avgStudentsPerBatch = studentStats.length > 0 ? Math.round(studentStats[0].avgStudents) : 0;
        const totalStudentsInBatches = studentStats.length > 0 ? studentStats[0].totalStudents : 0;

        res.status(200).json({
            success: true,
            data: {
                batches,
                kpis: {
                    totalBatches,
                    activeBatches,
                    completedBatches,
                    avgStudentsPerBatch,
                    totalStudentsInBatches
                }
            }
        });
    } catch (error) {
        console.error('Superadmin Fetch Batches Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch global batches' });
    }
};