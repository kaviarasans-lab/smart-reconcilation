const reconciliationService = require('../services/reconciliationService');
const UploadJob = require('../models/UploadJob');
const ReconciliationResult = require('../models/ReconciliationResult');
const User = require('../models/User');

// @desc    Get dashboard summary
// @route   GET /api/dashboard/summary
const getSummary = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, status, uploadedBy } = req.query;

    const summary = await reconciliationService.getSummary({
      dateFrom,
      dateTo,
      status,
      uploadedBy,
    });

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

// @desc    Get chart data for dashboard
// @route   GET /api/dashboard/chart
const getChartData = async (req, res, next) => {
  try {
    const { dateFrom, dateTo, uploadedBy } = req.query;

    // Build job filter
    const jobQuery = {};
    if (uploadedBy) jobQuery.uploadedBy = uploadedBy;
    if (dateFrom || dateTo) {
      jobQuery.createdAt = {};
      if (dateFrom) jobQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) jobQuery.createdAt.$lte = new Date(dateTo);
    }

    const jobs = await UploadJob.find(jobQuery).select('_id');
    const jobIds = jobs.map((j) => j._id);

    // Status distribution for donut chart
    const statusDistribution = await ReconciliationResult.aggregate([
      { $match: { uploadJobId: { $in: jobIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Daily trend for bar chart
    const dailyTrend = await ReconciliationResult.aggregate([
      { $match: { uploadJobId: { $in: jobIds } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusDistribution: statusDistribution.map((item) => ({
          name: item._id,
          value: item.count,
        })),
        dailyTrend,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get filter options (users who have uploaded)
// @route   GET /api/dashboard/filters
const getFilterOptions = async (req, res, next) => {
  try {
    const uploaders = await UploadJob.distinct('uploadedBy');
    const users = await User.find({ _id: { $in: uploaders } }).select('name email');

    res.status(200).json({
      success: true,
      data: {
        uploaders: users,
        statuses: ['matched', 'partially_matched', 'not_matched', 'duplicate'],
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSummary, getChartData, getFilterOptions };
