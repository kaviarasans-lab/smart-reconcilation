const ReconciliationResult = require('../models/ReconciliationResult');
const Record = require('../models/Record');
const UploadJob = require('../models/UploadJob');
const reconciliationService = require('../services/reconciliationService');
const auditService = require('../services/auditService');

// @desc    Run reconciliation for an upload job
// @route   POST /api/reconciliation/run/:uploadJobId
const runReconciliation = async (req, res, next) => {
  try {
    const { uploadJobId } = req.params;

    const job = await UploadJob.findById(uploadJobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Upload job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Upload must be completed before reconciliation' });
    }

    const summary = await reconciliationService.reconcile(uploadJobId, req.user._id, req.user.name);

    res.status(200).json({
      success: true,
      data: summary,
      message: 'Reconciliation completed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reconciliation results for an upload job
// @route   GET /api/reconciliation/:uploadJobId
const getResults = async (req, res, next) => {
  try {
    const { uploadJobId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    const query = { uploadJobId };
    if (status) query.status = status;

    const total = await ReconciliationResult.countDocuments(query);
    const results = await ReconciliationResult.find(query)
      .populate('uploadedRecordId')
      .populate('systemRecordId')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: results,
      pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reconciliation summary for an upload job
// @route   GET /api/reconciliation/:uploadJobId/summary
const getJobSummary = async (req, res, next) => {
  try {
    const { uploadJobId } = req.params;

    const pipeline = [
      { $match: { uploadJobId: require('mongoose').Types.ObjectId.createFromHexString(uploadJobId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ];

    const statusCounts = await ReconciliationResult.aggregate(pipeline);

    const summary = { matched: 0, partially_matched: 0, not_matched: 0, duplicate: 0, total: 0 };
    for (const item of statusCounts) {
      summary[item._id] = item.count;
      summary.total += item.count;
    }

    summary.accuracy = summary.total > 0
      ? parseFloat((((summary.matched + summary.partially_matched) / summary.total) * 100).toFixed(2))
      : 0;

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually resolve a reconciliation result
// @route   PUT /api/reconciliation/:id/resolve
const resolveResult = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newStatus, correctedFields } = req.body;

    const result = await ReconciliationResult.findById(id)
      .populate('uploadedRecordId')
      .populate('systemRecordId');

    if (!result) {
      return res.status(404).json({ success: false, error: 'Reconciliation result not found' });
    }

    const oldValue = {
      status: result.status,
      mismatchedFields: result.mismatchedFields,
      manuallyResolved: result.manuallyResolved,
    };

    // Update the uploaded record if corrections are provided
    if (correctedFields) {
      const uploadedRecord = await Record.findById(result.uploadedRecordId);
      if (uploadedRecord) {
        const oldRecord = uploadedRecord.toObject();
        Object.assign(uploadedRecord, correctedFields);
        await uploadedRecord.save();

        // Audit the record change
        await auditService.log({
          entityType: 'record',
          entityId: uploadedRecord._id,
          action: 'update',
          oldValue: oldRecord,
          newValue: correctedFields,
          userId: req.user._id,
          userName: req.user.name,
          source: 'manual',
        });
      }
    }

    // Update reconciliation result
    result.status = newStatus || result.status;
    result.manuallyResolved = true;
    result.resolvedBy = req.user._id;
    result.resolvedAt = new Date();
    await result.save();

    // Audit the resolution
    await auditService.log({
      entityType: 'reconciliation_result',
      entityId: result._id,
      action: 'manual_resolve',
      oldValue,
      newValue: {
        status: result.status,
        manuallyResolved: true,
        resolvedBy: req.user.name,
        correctedFields: correctedFields || null,
      },
      userId: req.user._id,
      userName: req.user.name,
      source: 'manual',
    });

    res.status(200).json({
      success: true,
      data: result,
      message: 'Record resolved successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { runReconciliation, getResults, getJobSummary, resolveResult };
