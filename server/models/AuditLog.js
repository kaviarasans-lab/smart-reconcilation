const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  entityType: {
    type: String,
    enum: ['record', 'reconciliation_result', 'upload_job'],
    required: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },
  action: {
    type: String,
    enum: ['create', 'update', 'manual_resolve', 'upload', 'reconcile', 'reprocess'],
    required: true,
  },
  oldValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  userName: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    enum: ['system', 'manual'],
    default: 'system',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Immutability: remove update and delete operations
auditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('Audit logs are immutable and cannot be updated');
});

auditLogSchema.pre('updateOne', function () {
  throw new Error('Audit logs are immutable and cannot be updated');
});

auditLogSchema.pre('updateMany', function () {
  throw new Error('Audit logs are immutable and cannot be updated');
});

auditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('Audit logs are immutable and cannot be deleted');
});

auditLogSchema.pre('deleteOne', function () {
  throw new Error('Audit logs are immutable and cannot be deleted');
});

auditLogSchema.pre('deleteMany', function () {
  throw new Error('Audit logs are immutable and cannot be deleted');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
