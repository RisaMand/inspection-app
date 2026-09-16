const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { loginSchema } = require('../validators/auth.validator');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const { loginLimiter } = require('../middleware/rateLimiter');

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(authController.login));
router.get('/me', authenticate, asyncHandler(authController.me));
router.post('/logout', authenticate, authController.logout);

module.exports = router;
