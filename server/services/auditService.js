const AuditLog = require('../models/AuditLog');

/**
 * Centralized audit logging service.
 * All audit log entries are created through this service to ensure consistency.
 */
const auditService = {
  /**
   * Create an audit log entry
   * @param {Object} params
   * @param {string} params.entityType - 'record' | 'reconciliation_result' | 'upload_job'
   * @param {ObjectId} params.entityId - ID of the entity being audited
   * @param {string} params.action - 'create' | 'update' | 'manual_resolve' | 'upload' | 'reconcile' | 'reprocess'
   * @param {Object} params.oldValue - Previous value (null for create)
   * @param {Object} params.newValue - New value
   * @param {ObjectId} params.userId - ID of the user performing the action
   * @param {string} params.userName - Name of the user
   * @param {string} params.source - 'system' | 'manual'
   */
  async log({ entityType, entityId, action, oldValue = null, newValue = null, userId, userName, source = 'system' }) {
    try {
      await AuditLog.create({
        entityType,
        entityId,
        action,
        oldValue,
        newValue,
        userId,
        userName,
        source,
        timestamp: new Date(),
      });
    } catch (error) {
      // Audit logging should not break the main flow
      console.error('Audit log error:', error.message);
    }
  },

  /**
   * Get audit logs for a specific entity
   */
  async getByEntity(entityId) {
    return AuditLog.find({ entityId }).sort({ timestamp: -1 });
  },

  /**
   * Get all audit logs with filters
   */
  async getAll({ entityType, userId, startDate, endDate, page = 1, limit = 50 }) {
    const query = {};

    if (entityType) query.entityType = entityType;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  },
};

module.exports = auditService;
