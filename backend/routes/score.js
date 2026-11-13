// backend/routes/score.js
const express = require('express');
const router = express.Router();
const scoreController = require('../controllers/scoreController');
const { requireUser } = require('../middleware/auth');

// All financial health routes require authenticated user
router.use(requireUser);

// GET /api/financial-health/score
router.get('/score', (req, res) => scoreController.getScore(req, res));

// GET /api/financial-health/history
router.get('/history', (req, res) => scoreController.getHistory(req, res));

module.exports = router;
