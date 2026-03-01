import AuditLog from '../models/AuditLog.js';

/**
 * Audit middleware — logs all mutating requests (POST, PUT, PATCH, DELETE)
 * to the AuditLog collection for compliance and security tracking.
 */
export const auditMiddleware = (req, res, next) => {
    // Only log mutating requests
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutatingMethods.includes(req.method)) {
        return next();
    }

    // Skip certain paths that are too noisy
    const skipPaths = ['/api/health', '/api/progress'];
    if (skipPaths.some(p => req.path.startsWith(p))) {
        return next();
    }

    // Capture the original res.json to log after response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        // Log asynchronously — don't block the response
        setImmediate(async () => {
            try {
                await AuditLog.create({
                    userId: req.user?.id || req.user?._id || null,
                    adminId: req.user?.role === 'admin' ? req.user.id : null,
                    action: `${req.method} ${req.path}`,
                    resource: req.path.split('/')[2] || '', // e.g., 'courses', 'payments'
                    method: req.method,
                    path: req.originalUrl || req.path,
                    statusCode: res.statusCode,
                    ip: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '',
                    userAgent: req.headers['user-agent'] || '',
                    details: {
                        params: req.params,
                        // Don't log sensitive body fields
                        body: sanitizeBody(req.body),
                    },
                });
            } catch (err) {
                console.error('Audit log error:', err.message);
            }
        });

        return originalJson(body);
    };

    next();
};

// Remove sensitive fields from logged body
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return {};
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'razorpaySignature', 'twoFactorSecret', 'otp'];
    sensitiveFields.forEach(field => {
        if (sanitized[field]) sanitized[field] = '[REDACTED]';
    });
    return sanitized;
}
