const express = require('express');
const router = express.Router();
const { success } = require('../utils/apiResponse');

const authRoutes = require('./auth.routes');
const ruleRoutes = require('./rule.routes');
const inspectionRoutes = require('./inspections.routes');
const syncRoutes = require('./sync.routes');
const dashboardRoutes = require('./dashboard.routes');
const sessionRoutes = require('./session.routes');
const productRoutes = require('./product.routes');
const photoRoutes = require('./photo.routes');

router.get('/health', (req, res) => {
  res.json(success({ status: 'ok', timestamp: new Date().toISOString() }));
});

router.use('/auth', authRoutes);
router.use('/rules', ruleRoutes);
router.use('/inspections', inspectionRoutes);
router.use('/sync', syncRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/sessions', sessionRoutes);
router.use('/products', productRoutes);
router.use('/photos', photoRoutes);
module.exports = router;
