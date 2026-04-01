const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');
const {
    dateParamValidation,
    analyticsWeeklyQueryValidation,
    analyticsMonthlyQueryValidation,
    analyticsTrendsQueryValidation
} = require('../middleware/validator');

// All routes require authentication
router.use(authMiddleware);

// Analytics routes
router.get('/daily/:date', dateParamValidation, AnalyticsController.getDailyAnalytics);
router.get('/weekly', analyticsWeeklyQueryValidation, AnalyticsController.getWeeklyAnalytics);
router.get('/monthly', analyticsMonthlyQueryValidation, AnalyticsController.getMonthlyAnalytics);
router.get('/summary', AnalyticsController.getSummary);
router.get('/trends', analyticsTrendsQueryValidation, AnalyticsController.getTrends);

module.exports = router;
