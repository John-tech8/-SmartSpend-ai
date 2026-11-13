// backend/routes/chat.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// POST /api/chat - Send message and get AI response
router.post('/', (req, res) => chatController.sendMessage(req, res));

module.exports = router;
