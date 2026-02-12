const Record = require('../models/Record');
const ReconciliationResult = require('../models/ReconciliationResult');
const UploadJob = require('../models/UploadJob');
const auditService = require('./auditService');
const reconciliationRules = require('../config/reconciliation');

const reconciliationService = {
  /**
   * Run reconciliation for all records in an upload job
   */
  async reconcile(uploadJobId, userId, userName) {
    // Get all uploaded records for this job
    const uploadedRecords = await Record.find({ uploadJobId, source: 'upload' });

    if (uploadedRecords.length === 0) {
      throw new Error('No uploaded records found for this job');
    }

    // Clear previous reconciliation results for this job (for reprocessing)
    await ReconciliationResult.deleteMany({ uploadJobId });

    // Get all system records for matching
    const systemRecords = await Record.find({ source: 'system' });

    // Build lookup maps for efficient matching
    const systemByTxnId = new Map();
    const systemByRefNum = new Map();

    for (const sysRec of systemRecords) {
      // Group by transactionId
      if (!systemByTxnId.has(sysRec.transactionId)) {
        systemByTxnId.set(sysRec.transactionId, []);
      }
      systemByTxnId.get(sysRec.transactionId).push(sysRec);

      // Group by referenceNumber
      if (!systemByRefNum.has(sysRec.referenceNumber)) {
        systemByRefNum.set(sysRec.referenceNumber, []);
      }
      systemByRefNum.get(sysRec.referenceNumber).push(sysRec);
    }

    // Detect duplicates in uploaded data
    const uploadTxnIdCount = new Map();
    for (const rec of uploadedRecords) {
      uploadTxnIdCount.set(rec.transactionId, (uploadTxnIdCount.get(rec.transactionId) || 0) + 1);
    }

    const results = [];

    for (const uploaded of uploadedRecords) {
      let result = null;

      // Step 1: Check for duplicates
      if (reconciliationRules.duplicate.enabled && uploadTxnIdCount.get(uploaded.transactionId) > 1) {
        result = {
          uploadedRecordId: uploaded._id,
          systemRecordId: null,
          status: 'duplicate',
          mismatchedFields: [],
          matchScore: 0,
          uploadJobId,
        };
      }

      // Step 2: Try exact match (Transaction ID + Amount)
      if (!result && reconciliationRules.exactMatch.enabled) {
        const candidates = systemByTxnId.get(uploaded.transactionId) || [];
        for (const sysRec of candidates) {
          if (sysRec.amount === uploaded.amount) {
            result = {
              uploadedRecordId: uploaded._id,
              systemRecordId: sysRec._id,
              status: 'matched',
              mismatchedFields: [],
              matchScore: 100,
              uploadJobId,
            };
            break;
          }
        }
      }

      // Step 3: Try partial match (Reference Number + Amount within tolerance)
      if (!result && reconciliationRules.partialMatch.enabled) {
        const candidates = systemByRefNum.get(uploaded.referenceNumber) || [];
        for (const sysRec of candidates) {
          const tolerance = reconciliationRules.partialMatch.tolerance.amount;
          const amountDiff = Math.abs(sysRec.amount - uploaded.amount);
          const maxVariance = sysRec.amount * tolerance;

          if (amountDiff <= maxVariance) {
            const mismatches = [];

            // Check all comparable fields for mismatches
            if (sysRec.transactionId !== uploaded.transactionId) {
              mismatches.push({
                field: 'transactionId',
                uploadedValue: uploaded.transactionId,
                systemValue: sysRec.transactionId,
              });
            }
            if (sysRec.amount !== uploaded.amount) {
              mismatches.push({
                field: 'amount',
                uploadedValue: uploaded.amount,
                systemValue: sysRec.amount,
              });
            }
            if (sysRec.date?.toISOString?.() !== uploaded.date?.toISOString?.()) {
              mismatches.push({
                field: 'date',
                uploadedValue: uploaded.date,
                systemValue: sysRec.date,
              });
            }

            const matchScore = Math.round((1 - amountDiff / (sysRec.amount || 1)) * 100);

            result = {
              uploadedRecordId: uploaded._id,
              systemRecordId: sysRec._id,
              status: 'partially_matched',
              mismatchedFields: mismatches,
              matchScore: Math.max(0, matchScore),
              uploadJobId,
            };
            break;
          }
        }
      }

      // Step 4: No match found
      if (!result) {
        result = {
          uploadedRecordId: uploaded._id,
          systemRecordId: null,
          status: 'not_matched',
          mismatchedFields: [],
          matchScore: 0,
          uploadJobId,
        };
      }

      results.push(result);
    }

    // Batch insert results
    const batchSize = 1000;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      await ReconciliationResult.insertMany(batch);
    }

    // Update upload job as reconciled
    await UploadJob.findByIdAndUpdate(uploadJobId, { reconciled: true });

    // Audit log
    await auditService.log({
      entityType: 'upload_job',
      entityId: uploadJobId,
      action: 'reconcile',
      newValue: {
        totalRecords: results.length,
        matched: results.filter((r) => r.status === 'matched').length,
        partiallyMatched: results.filter((r) => r.status === 'partially_matched').length,
        notMatched: results.filter((r) => r.status === 'not_matched').length,
        duplicate: results.filter((r) => r.status === 'duplicate').length,
      },
      userId,
      userName,
      source: 'system',
    });

    return {
      total: results.length,
      matched: results.filter((r) => r.status === 'matched').length,
      partiallyMatched: results.filter((r) => r.status === 'partially_matched').length,
      notMatched: results.filter((r) => r.status === 'not_matched').length,
      duplicate: results.filter((r) => r.status === 'duplicate').length,
    };
  },

  /**
   * Get reconciliation summary for dashboard
   */
  async getSummary({ dateFrom, dateTo, status, uploadedBy }) {
    const jobQuery = {};
    if (uploadedBy) jobQuery.uploadedBy = uploadedBy;
    if (dateFrom || dateTo) {
      jobQuery.createdAt = {};
      if (dateFrom) jobQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) jobQuery.createdAt.$lte = new Date(dateTo);
    }

    const jobs = await UploadJob.find(jobQuery).select('_id');
    const jobIds = jobs.map((j) => j._id);

    const resultQuery = { uploadJobId: { $in: jobIds } };
    if (status) resultQuery.status = status;

    const pipeline = [
      { $match: { uploadJobId: { $in: jobIds } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ];

    const statusCounts = await ReconciliationResult.aggregate(pipeline);

    const summary = {
      totalRecords: 0,
      matched: 0,
      partiallyMatched: 0,
      notMatched: 0,
      duplicate: 0,
      accuracy: 0,
    };

    for (const item of statusCounts) {
      summary.totalRecords += item.count;
      switch (item._id) {
        case 'matched':
          summary.matched = item.count;
          break;
        case 'partially_matched':
          summary.partiallyMatched = item.count;
          break;
        case 'not_matched':
          summary.notMatched = item.count;
          break;
        case 'duplicate':
          summary.duplicate = item.count;
          break;
      }
    }

    if (summary.totalRecords > 0) {
      summary.accuracy = parseFloat(
        (((summary.matched + summary.partiallyMatched) / summary.totalRecords) * 100).toFixed(2)
      );
    }

    return summary;
  },
};

module.exports = reconciliationService;
