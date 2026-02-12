const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  referenceNumber: {
    type: String,
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  source: {
    type: String,
    enum: ['system', 'upload'],
    required: true,
  },
  uploadJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UploadJob',
    default: null,
    index: true,
  },
  rawData: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for efficient reconciliation queries
recordSchema.index({ transactionId: 1, source: 1 });
recordSchema.index({ referenceNumber: 1, source: 1 });

module.exports = mongoose.model('Record', recordSchema);
