const express = require('express');
const router = express.Router();
const { runReconciliation, getResults, getJobSummary, resolveResult } = require('../controllers/reconciliationController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.post('/run/:uploadJobId', protect, authorize('admin', 'analyst'), runReconciliation);
router.get('/:uploadJobId', protect, getResults);
router.get('/:uploadJobId/summary', protect, getJobSummary);
router.put('/:id/resolve', protect, authorize('admin', 'analyst'), resolveResult);

module.exports = router;
