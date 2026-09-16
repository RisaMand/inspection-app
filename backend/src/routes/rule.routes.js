const express = require('express');
const router = express.Router();
const ruleController = require('../controllers/rule.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');

// Read-only for all authenticated users
router.get('/active', authenticate, asyncHandler(ruleController.getActiveRules));
router.get('/versions', authenticate, asyncHandler(ruleController.getRuleVersions));
router.get('/versions/:version', authenticate, asyncHandler(ruleController.getRuleByVersion));

// Admin only write endpoints
const validate = require('../middleware/validate');
const { createRuleConfigSchema, activateRuleConfigSchema } = require('../validators/rule.validator');

router.post('/', authenticate, authorize('ADMIN'), validate(createRuleConfigSchema), asyncHandler(ruleController.createRuleConfig));
router.post('/:version/activate', authenticate, authorize('ADMIN'), validate(activateRuleConfigSchema), asyncHandler(ruleController.activateRuleConfig));

module.exports = router;