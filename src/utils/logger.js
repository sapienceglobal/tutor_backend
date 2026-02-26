import AuditLog from '../models/AuditLog.js';

/**
 * Helper utility to log critical admin actions.
 * @param {string} adminId - The MongoDB ID of the admin performing the action.
 * @param {string} action - The action string (e.g., 'APPROVE_COURSE').
 * @param {string} entityType - The type of entity ('course', 'tutor', etc.).
 * @param {string} entityId - The MongoDB ID of the entity being acted upon (optional).
 * @param {object} details - Any additional context or payload representing the change.
 */
export const logAdminAction = async (adminId, action, entityType, entityId = null, details = {}) => {
    try {
        await AuditLog.create({
            adminId,
            action,
            entityType,
            entityId,
            details
        });
    } catch (error) {
        console.error('Failed to write Audit Log:', error, { adminId, action, entityId });
        // NOTE: We do not throw this error. Audit logging shouldn't crash the main transaction
        // if the database is otherwise operational.
    }
};
