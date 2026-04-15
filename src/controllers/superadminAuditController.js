import AuditLog from '../models/AuditLog.js';

// @desc    Get system audit logs and security KPIs
// @route   GET /api/superadmin/security/logs
// @access  Private/Superadmin
export const getAuditLogs = async (req, res) => {
    try {
        const { method, search, limit = 100 } = req.query;

        let query = {};
        
        // Filter by HTTP Method
        if (method && method !== 'all') {
            query.method = method.toUpperCase();
        }

        // Search by Action, Path, or IP
        if (search) {
            query.$or = [
                { action: { $regex: search, $options: 'i' } },
                { path: { $regex: search, $options: 'i' } },
                { ip: { $regex: search, $options: 'i' } }
            ];
        }

        // Fetch logs with User details
        const logs = await AuditLog.find(query)
            .populate('userId', 'name email role profileImage')
            // Fallback for legacy adminId if userId is missing
            .populate('adminId', 'name email role profileImage') 
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .lean();

        // ─── Calculate Security KPIs ───
        const totalLogs = await AuditLog.countDocuments();
        
        // Critical Actions (Mutations: POST, PUT, PATCH, DELETE)
        const criticalActions = await AuditLog.countDocuments({ 
            method: { $in: ['POST', 'PUT', 'PATCH', 'DELETE'] } 
        });

        // Failed/Unauthorized Attempts (Status 4xx or 5xx)
        const failedAttempts = await AuditLog.countDocuments({ 
            statusCode: { $gte: 400 } 
        });

        res.status(200).json({
            success: true,
            data: {
                logs,
                kpis: {
                    totalLogs,
                    criticalActions,
                    failedAttempts
                }
            }
        });
    } catch (error) {
        console.error('Fetch Audit Logs Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
    }
};