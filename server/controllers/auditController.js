const auditService = require('../services/auditService');

// @desc    Get audit logs for a specific entity
// @route   GET /api/audit/entity/:entityId
const getEntityAudit = async (req, res, next) => {
  try {
    const logs = await auditService.getByEntity(req.params.entityId);
    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all audit logs with filters
// @route   GET /api/audit
const getAllAuditLogs = async (req, res, next) => {
  try {
    const { entityType, userId, startDate, endDate, page = 1, limit = 50 } = req.query;

    const result = await auditService.getAll({
      entityType,
      userId,
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

module.exports = { getEntityAudit, getAllAuditLogs };
