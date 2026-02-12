const express = require('express');
const router = express.Router();
const { getEntityAudit, getAllAuditLogs } = require('../controllers/auditController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.get('/', protect, authorize('admin'), getAllAuditLogs);
router.get('/entity/:entityId', protect, getEntityAudit);

module.exports = router;
