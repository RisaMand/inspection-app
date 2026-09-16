const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photo.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);

// INSPECTOR is the only real caller per the pipeline (photos are captured
// in the field). ADMIN included for the same reason it's on other
// capture-adjacent routes -- a manual/support path, never called by either
// real app. OFFICIAL has no reason to ever upload a photo.
router.post('/upload-url', authorize('INSPECTOR', 'ADMIN'), asyncHandler(photoController.createUploadUrl));

module.exports = router;