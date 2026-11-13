// backend/routes/conversations.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// GET /api/conversations - List user conversations
router.get('/', (req, res) => chatController.getUserConversations(req, res));

// GET /api/conversations/:id/messages - Get messages in conversation
router.get('/:id/messages', (req, res) => chatController.getMessages(req, res));

// DELETE /api/conversations/:id - Clear/delete conversation
router.delete('/:id', (req, res) => chatController.clearConversation(req, res));

module.exports = router;
