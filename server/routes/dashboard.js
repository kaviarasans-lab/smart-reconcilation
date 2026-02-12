const express = require('express');
const router = express.Router();
const { getSummary, getChartData, getFilterOptions } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.get('/summary', protect, getSummary);
router.get('/chart', protect, getChartData);
router.get('/filters', protect, getFilterOptions);

module.exports = router;
