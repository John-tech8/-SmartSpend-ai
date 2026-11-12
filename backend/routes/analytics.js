// backend/routes/analytics.js
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { requireUser } = require('../middleware/auth');

// All analytics routes require authenticated user
router.use(requireUser);

// GET /api/analytics/overview
router.get('/overview', (req, res) => analyticsController.getOverview(req, res));

// GET /api/analytics/categories
router.get('/categories', (req, res) => analyticsController.getCategories(req, res));

// GET /api/analytics/monthly-comparison
router.get('/monthly-comparison', (req, res) => analyticsController.getMonthlyComparison(req, res));

// GET /api/analytics/trends
router.get('/trends', (req, res) => analyticsController.getTrends(req, res));

// GET /api/analytics/ai-insights
router.get('/ai-insights', (req, res) => analyticsController.getAIInsights(req, res));

// GET /api/analytics/behaviour
router.get('/behaviour', (req, res) => analyticsController.getBehaviour(req, res));

module.exports = router;
