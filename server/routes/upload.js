const express = require('express');
const router = express.Router();
const { uploadFile, getPreview, saveMapping, getStatus, getUploadJobs } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');
const upload = require('../middleware/upload');

router.get('/', protect, getUploadJobs);
router.post('/', protect, authorize('admin', 'analyst'), upload.single('file'), uploadFile);
router.get('/:id/preview', protect, getPreview);
router.put('/:id/mapping', protect, authorize('admin', 'analyst'), saveMapping);
router.get('/:id/status', protect, getStatus);

module.exports = router;
