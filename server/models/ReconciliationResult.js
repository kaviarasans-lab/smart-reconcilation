const mongoose = require('mongoose');

const reconciliationResultSchema = new mongoose.Schema({
  uploadedRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Record',
    required: true,
  },
  systemRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Record',
    default: null,
  },
  status: {
    type: String,
    enum: ['matched', 'partially_matched', 'not_matched', 'duplicate'],
    required: true,
  },
  mismatchedFields: [
    {
      field: String,
      uploadedValue: mongoose.Schema.Types.Mixed,
      systemValue: mongoose.Schema.Types.Mixed,
    },
  ],
  matchScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  uploadJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UploadJob',
    required: true,
    index: true,
  },
  manuallyResolved: {
    type: Boolean,
    default: false,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

reconciliationResultSchema.index({ status: 1 });
reconciliationResultSchema.index({ uploadedRecordId: 1 });

module.exports = mongoose.model('ReconciliationResult', reconciliationResultSchema);
