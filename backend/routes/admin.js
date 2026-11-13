// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

// Apply admin auth middleware to all admin instruction routes
router.use('/instructions', requireAdmin);
router.use('/verify', requireAdmin);

// Verify admin access
router.post('/verify', (req, res) => adminController.verifyAuth(req, res));

// GET /api/admin/instructions
router.get('/instructions', (req, res) => adminController.getInstructions(req, res));

// POST /api/admin/instructions
router.post('/instructions', (req, res) => adminController.updateInstructions(req, res));

// POST /api/admin/instructions/reset
router.post('/instructions/reset', (req, res) => adminController.resetInstructions(req, res));

module.exports = router;
