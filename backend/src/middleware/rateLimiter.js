const rateLimit = require('express-rate-limit');
const { error } = require('../utils/apiResponse');

// A7: login had no brute-force protection at all. 10 attempts per 15-minute
// window per IP is generous enough for a real inspector who fat-fingers a
// password a couple times, but stops a credential-stuffing script cold.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      error('RATE_LIMITED', 'Too many login attempts. Please try again later.', [], req.id)
    );
  }
});

module.exports = { loginLimiter };