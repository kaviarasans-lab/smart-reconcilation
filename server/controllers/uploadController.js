const UploadJob = require('../models/UploadJob');
const Record = require('../models/Record');
const { uploadQueue } = require('../config/redis');
const { computeFileHash } = require('../utils/fileHash');
const fileService = require('../services/fileService');
const auditService = require('../services/auditService');

// @desc    Upload a file
// @route   POST /api/upload
const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please upload a file' });
    }

    // Compute file hash for idempotency
    const fileHash = await computeFileHash(req.file.path);

    // Check if this file was already uploaded
    const existingJob = await UploadJob.findOne({ fileHash });
    if (existingJob) {
      return res.status(200).json({
        success: true,
        data: existingJob,
        message: 'File already uploaded. Returning existing job.',
        duplicate: true,
      });
    }

    // Create upload job
    const uploadJob = await UploadJob.create({
      fileName: req.file.filename,
      originalName: req.file.originalname,
      fileHash,
      status: 'pending',
      uploadedBy: req.user._id,
    });

    // Audit log
    await auditService.log({
      entityType: 'upload_job',
      entityId: uploadJob._id,
      action: 'create',
      newValue: { fileName: req.file.originalname, fileHash },
      userId: req.user._id,
      userName: req.user.name,
      source: 'manual',
    });

    res.status(201).json({
      success: true,
      data: uploadJob,
      message: 'File uploaded. Map columns and submit to start processing.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get upload job preview (first 20 rows)
// @route   GET /api/upload/:id/preview
const getPreview = async (req, res, next) => {
  try {
    const job = await UploadJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Upload job not found' });
    }

    const filePath = require('path').join(__dirname, '..', 'uploads', job.fileName);
    const preview = await fileService.getPreview(filePath, 20);

    res.status(200).json({ success: true, data: preview });
  } catch (error) {
    next(error);
  }
};

// @desc    Save column mapping and start processing
// @route   PUT /api/upload/:id/mapping
const saveMapping = async (req, res, next) => {
  try {
    const { mapping } = req.body;

    if (!mapping || !mapping.transactionId || !mapping.amount || !mapping.referenceNumber || !mapping.date) {
      return res.status(400).json({
        success: false,
        error: 'Mapping must include transactionId, amount, referenceNumber, and date',
      });
    }

    const job = await UploadJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Upload job not found' });
    }

    // If already processing or completed, delete old records for reprocessing
    if (job.status === 'completed' || job.status === 'processing') {
      await Record.deleteMany({ uploadJobId: job._id, source: 'upload' });
    }

    // Update mapping
    job.columnMapping = mapping;
    job.status = 'pending';
    job.processedRecords = 0;
    job.errorMessage = null;
    await job.save();

    // Enqueue processing job
    const filePath = require('path').join(__dirname, '..', 'uploads', job.fileName);
    await uploadQueue.add({
      uploadJobId: job._id.toString(),
      filePath,
      columnMapping: mapping,
      userId: req.user._id.toString(),
      userName: req.user.name,
    });

    // Audit log
    await auditService.log({
      entityType: 'upload_job',
      entityId: job._id,
      action: 'update',
      oldValue: { columnMapping: job.columnMapping },
      newValue: { columnMapping: mapping },
      userId: req.user._id,
      userName: req.user.name,
      source: 'manual',
    });

    res.status(200).json({
      success: true,
      data: job,
      message: 'Column mapping saved. File processing started.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get upload job status
// @route   GET /api/upload/:id/status
const getStatus = async (req, res, next) => {
  try {
    const job = await UploadJob.findById(req.params.id).populate('uploadedBy', 'name email');
    if (!job) {
      return res.status(404).json({ success: false, error: 'Upload job not found' });
    }

    res.status(200).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all upload jobs
// @route   GET /api/upload
const getUploadJobs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const query = {};
    // Non-admin users can only see their own uploads
    if (req.user.role !== 'admin') {
      query.uploadedBy = req.user._id;
    }

    const total = await UploadJob.countDocuments(query);
    const jobs = await UploadJob.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: jobs,
      pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadFile, getPreview, saveMapping, getStatus, getUploadJobs };
