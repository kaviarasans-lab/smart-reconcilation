const mongoose = require('mongoose');

const uploadJobSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  fileHash: {
    type: String,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  totalRecords: {
    type: Number,
    default: 0,
  },
  processedRecords: {
    type: Number,
    default: 0,
  },
  columnMapping: {
    type: Map,
    of: String,
    default: {},
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  errorMessage: {
    type: String,
    default: null,
  },
  reconciled: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('UploadJob', uploadJobSchema);
