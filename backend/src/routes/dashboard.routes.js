const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate, authorize('OFFICIAL', 'ADMIN'));

router.get('/summary', asyncHandler(dashboardController.getSummary));
router.get('/violations', asyncHandler(dashboardController.getViolations));
router.get('/inspectors', asyncHandler(dashboardController.getInspectors));
router.get('/officer-activity', asyncHandler(dashboardController.getOfficerActivity));
router.get('/search', asyncHandler(dashboardController.searchDashboard));

// Explicit re-exports or forwarding for dashboard/inspections can just use the regular inspections route
// but as per spec: GET /dashboard/inspections and GET /dashboard/inspections/:id
// We will just mount the inspections router or write simple wrappers. Let's just create wrappers for completeness.

const { getInspections, getInspectionById } = require('../controllers/inspection.controller');
router.get('/inspections', asyncHandler(getInspections));
router.get('/inspections/:id', asyncHandler(getInspectionById));

module.exports = router;
