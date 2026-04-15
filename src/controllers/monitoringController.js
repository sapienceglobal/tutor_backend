import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import AIUsageLog from '../models/AIUsageLog.js';
import Lesson from '../models/Lesson.js';
import Report from '../models/Report.js';
import os from 'os';

// @desc    Get System Monitoring & Health Data
// @route   GET /api/superadmin/monitoring/overview
// @access  Private/Superadmin
export const getMonitoringOverview = async (req, res) => {
    try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        // ─── 1. SERVER HARDWARE METRICS (Node.js os & process) ───
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(1);
        
        const serverUptime = process.uptime(); // in seconds

        // ─── 2. API HEALTH & ERRORS (From AuditLog) ───
        // Total API requests in last 24h
        const totalRequests = await AuditLog.countDocuments({ createdAt: { $gte: twentyFourHoursAgo } });
        
        // Failed requests (Status 400 or above)
        const failedRequests = await AuditLog.countDocuments({ 
            createdAt: { $gte: twentyFourHoursAgo },
            statusCode: { $gte: 400 }
        });

        const errorRate = totalRequests > 0 ? ((failedRequests / totalRequests) * 100).toFixed(2) : 0;

        // Recent 5 Errors for the UI
        const recentErrors = await AuditLog.find({ statusCode: { $gte: 400 } })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('method path statusCode action createdAt ip');


        // ─── 3. STORAGE CALCULATION (From Lesson Documents) ───
        // Aggregating bytes from lesson.content.documents
        const storageAgg = await Lesson.aggregate([
            { $unwind: "$content.documents" },
            { $group: { _id: null, totalBytes: { $sum: "$content.documents.size" } } }
        ]);
        
        const totalDocumentBytes = storageAgg.length > 0 ? storageAgg[0].totalBytes : 0;
        const totalDocumentMB = (totalDocumentBytes / (1024 * 1024)).toFixed(2);


        // ─── 4. AI USAGE METRICS (From AIUsageLog) ───
        const aiAgg = await AIUsageLog.aggregate([
            { $group: { _id: null, totalTokens: { $sum: "$tokenCount" } } }
        ]);
        const totalAITokens = aiAgg.length > 0 ? aiAgg[0].totalTokens : 0;


        // ─── 5. PENDING REPORTS (From Report Schema) ───
        const pendingReportsCount = await Report.countDocuments({ status: 'Pending' });


        // ─── 6. SEND FINAL RESPONSE ───
        res.status(200).json({
            success: true,
            data: {
                server: {
                    uptimeSeconds: serverUptime,
                    memoryUsagePercent: parseFloat(memoryUsagePercent),
                    usedMemoryMB: (usedMemory / (1024 * 1024)).toFixed(0),
                    totalMemoryMB: (totalMemory / (1024 * 1024)).toFixed(0)
                },
                apiHealth: {
                    totalRequests24h: totalRequests,
                    failedRequests24h: failedRequests,
                    errorRate: parseFloat(errorRate),
                    recentErrors
                },
                storage: {
                    documentStorageMB: parseFloat(totalDocumentMB)
                },
                ai: {
                    totalTokensUsed: totalAITokens
                },
                moderation: {
                    pendingReports: pendingReportsCount
                }
            }
        });

    } catch (error) {
        console.error('Monitoring Overview Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch system monitoring data'
        });
    }
};