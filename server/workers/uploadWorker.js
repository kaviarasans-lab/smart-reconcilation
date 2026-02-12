const { uploadQueue } = require('../config/redis');
const UploadJob = require('../models/UploadJob');
const Record = require('../models/Record');
const fileService = require('../services/fileService');
const auditService = require('../services/auditService');

const BATCH_SIZE = 1000;

uploadQueue.process(async (job) => {
  const { uploadJobId, filePath, columnMapping, userId, userName } = job.data;

  try {
    // Update job status to processing
    await UploadJob.findByIdAndUpdate(uploadJobId, { status: 'processing' });

    // Parse file
    const rawData = await fileService.parseFile(filePath);
    const totalRecords = rawData.length;

    await UploadJob.findByIdAndUpdate(uploadJobId, { totalRecords });

    // Process records in batches
    let processedCount = 0;

    for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
      const batch = rawData.slice(i, i + BATCH_SIZE);

      const records = batch
        .map((row) => {
          const mapped = fileService.applyMapping(row, columnMapping);

          // Validate mandatory fields
          if (!mapped.transactionId || !mapped.amount || !mapped.referenceNumber || !mapped.date) {
            return null;
          }

          return {
            transactionId: String(mapped.transactionId).trim(),
            amount: parseFloat(mapped.amount),
            referenceNumber: String(mapped.referenceNumber).trim(),
            date: new Date(mapped.date),
            description: mapped.description || '',
            source: 'upload',
            uploadJobId,
            rawData: row,
          };
        })
        .filter((r) => r !== null && !isNaN(r.amount) && r.date instanceof Date && !isNaN(r.date));

      if (records.length > 0) {
        await Record.insertMany(records, { ordered: false });
      }

      processedCount += batch.length;

      // Update progress
      await UploadJob.findByIdAndUpdate(uploadJobId, { processedRecords: processedCount });

      // Report progress to Bull
      job.progress(Math.round((processedCount / totalRecords) * 100));
    }

    // Mark as completed
    await UploadJob.findByIdAndUpdate(uploadJobId, {
      status: 'completed',
      processedRecords: processedCount,
      completedAt: new Date(),
    });

    // Audit log
    await auditService.log({
      entityType: 'upload_job',
      entityId: uploadJobId,
      action: 'upload',
      newValue: { totalRecords, processedRecords: processedCount, status: 'completed' },
      userId,
      userName,
      source: 'system',
    });

    return { totalRecords, processedRecords: processedCount };
  } catch (error) {
    // Mark as failed
    await UploadJob.findByIdAndUpdate(uploadJobId, {
      status: 'failed',
      errorMessage: error.message,
    });

    await auditService.log({
      entityType: 'upload_job',
      entityId: uploadJobId,
      action: 'upload',
      newValue: { status: 'failed', error: error.message },
      userId,
      userName,
      source: 'system',
    });

    throw error;
  }
});

uploadQueue.on('failed', (job, err) => {
  console.error(`Upload job ${job.id} failed:`, err.message);
});

uploadQueue.on('completed', (job, result) => {
  console.log(`Upload job ${job.id} completed:`, result);
});

module.exports = uploadQueue;
