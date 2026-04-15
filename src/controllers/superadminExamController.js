import { Exam, ExamAttempt } from '../models/Exam.js';

// @desc    Get global exams, attempts, and AI Proctoring alerts (God View)
// @route   GET /api/superadmin/exams
// @access  Private/Superadmin
export const getGlobalExams = async (req, res) => {
    try {
        const { status, search } = req.query;

        // 1. Build Query for Exams
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        // 2. Fetch Latest Exams (Limit to 50 for dashboard speed)
        const exams = await Exam.find(query)
            .populate('courseId', 'title')
            .populate('instituteId', 'name')
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        // 3. Attach Advanced Stats (Attempts & Proctoring Alerts) to each Exam
        const examsWithStats = await Promise.all(exams.map(async (exam) => {
            const totalAttempts = await ExamAttempt.countDocuments({ examId: exam._id });
            
            // Count how many attempts were flagged by AI as Suspicious or Cheating
            const suspiciousAttempts = await ExamAttempt.countDocuments({ 
                examId: exam._id,
                aiRiskLevel: { $in: ['Suspicious Detected', 'Cheating Detected'] }
            });

            return {
                ...exam,
                stats: {
                    totalAttempts,
                    suspiciousAttempts
                }
            };
        }));

        // 4. Calculate Global KPIs
        const totalExams = await Exam.countDocuments();
        const activeExams = await Exam.countDocuments({ status: 'published' });
        const totalGlobalAttempts = await ExamAttempt.countDocuments();
        const globalCheatingAlerts = await ExamAttempt.countDocuments({ 
            aiRiskLevel: { $in: ['Suspicious Detected', 'Cheating Detected'] } 
        });

        res.status(200).json({
            success: true,
            data: {
                exams: examsWithStats,
                kpis: {
                    totalExams,
                    activeExams,
                    totalGlobalAttempts,
                    globalCheatingAlerts
                }
            }
        });
    } catch (error) {
        console.error('Superadmin Fetch Exams Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch global exams' });
    }
};