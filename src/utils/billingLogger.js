import AuditLog from '../models/AuditLog.js';

/**
 * Log billing and subscription events to AuditLog.
 * @param {string} userId - ID of the user triggering the event or admin processing.
 * @param {string} action - Billing action (e.g. 'BILLING_PAYMENT_SUCCESS').
 * @param {object} details - Specific billing context (amounts, plans, IDs).
 */
export const logBillingEvent = async (userId, action, details = {}) => {
    try {
        await AuditLog.create({
            userId: userId || null,
            action,
            resource: 'billing',
            details,
            path: '/api/billing/events',
            statusCode: 200,
        });
    } catch (error) {
        console.error('Failed to log billing event:', error);
    }
};
