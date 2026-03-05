const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');
const {
    dateParamValidation
} = require('../middleware/validator');

// All routes require authentication
router.use(authMiddleware);

// Analytics routes
router.get('/daily/:date', dateParamValidation, AnalyticsController.getDailyAnalytics);
router.get('/weekly', AnalyticsController.getWeeklyAnalytics);
router.get('/monthly', AnalyticsController.getMonthlyAnalytics);
router.get('/summary', AnalyticsController.getSummary);
router.get('/trends', AnalyticsController.getTrends);

module.exports = router;
