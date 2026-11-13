// backend/controllers/chatController.js
const conversationService = require('../services/conversationService');
const instructionService = require('../services/instructionService');
const aiService = require('../services/aiService');

class ChatController {
    /**
     * Send message & receive AI reply
     * POST /api/chat
     */
    async sendMessage(req, res) {
        try {
            const { message, conversationId: reqConvId, userId = 'guest', language = 'en' } = req.body;

            if (!message || typeof message !== 'string' || !message.trim()) {
                return res.status(400).json({ error: 'Message text is required.' });
            }

            // 1. Get or create active conversation
            let conversation;
            if (reqConvId) {
                conversation = await conversationService.getConversation(reqConvId, userId);
            }
            if (!conversation) {
                conversation = await conversationService.getOrCreateConversation(userId, message.trim().slice(0, 40));
            }

            const conversationId = conversation.id;

            // 2. Fetch recent conversation history before saving new message
            const priorMessages = await conversationService.getMessages(conversationId, userId);

            // 3. Persist user message in PostgreSQL
            const userMsgRecord = await conversationService.addMessage({
                conversationId,
                role: 'user',
                content: message.trim(),
                language,
                userId
            });

            // 4. Build dynamic system prompt with active instructions & language
            const systemPrompt = await instructionService.buildSystemPrompt(language);

            // 5. Generate AI response via Grok (xAI)
            let aiReplyText;
            try {
                aiReplyText = await aiService.generateResponse({
                    systemPrompt,
                    history: priorMessages,
                    userMessage: message.trim(),
                    language
                });
            } catch (aiErr) {
                console.error("AI Generation error:", aiErr.message);
                aiReplyText = "I'm having trouble connecting right now. Please check back in a few moments!";
            }

            // 6. Persist AI response in PostgreSQL
            const aiMsgRecord = await conversationService.addMessage({
                conversationId,
                role: 'assistant',
                content: aiReplyText,
                language,
                userId
            });

            // 7. Return reply
            return res.json({
                reply: aiReplyText,
                conversationId,
                userMessage: userMsgRecord,
                aiMessage: aiMsgRecord
            });

        } catch (error) {
            console.error('ChatController error:', error);
            const status = error.status || 500;
            return res.status(status).json({
                error: error.message || 'An error occurred while processing your message.'
            });
        }
    }

    /**
     * Get message history for a conversation
     * GET /api/conversations/:id/messages
     */
    async getMessages(req, res) {
        try {
            const conversationId = req.params.id;
            const userId = req.query.userId || req.headers['x-user-id'] || 'guest';

            const messages = await conversationService.getMessages(conversationId, userId);
            return res.json({ conversationId, messages });
        } catch (error) {
            console.error('GetMessages error:', error);
            const status = error.status || 500;
            return res.status(status).json({ error: error.message || 'Failed to retrieve messages.' });
        }
    }

    /**
     * Get user conversations
     * GET /api/conversations
     */
    async getUserConversations(req, res) {
        try {
            const userId = req.query.userId || req.headers['x-user-id'] || 'guest';
            const conversations = await conversationService.getUserConversations(userId);
            return res.json({ conversations });
        } catch (error) {
            console.error('GetUserConversations error:', error);
            return res.status(500).json({ error: 'Failed to retrieve conversations.' });
        }
    }

    /**
     * Clear / Delete a conversation
     * DELETE /api/conversations/:id
     */
    async clearConversation(req, res) {
        try {
            const conversationId = req.params.id;
            const userId = req.query.userId || req.headers['x-user-id'] || 'guest';

            await conversationService.clearConversation(conversationId, userId);
            return res.json({ success: true, message: 'Conversation cleared successfully.' });
        } catch (error) {
            console.error('ClearConversation error:', error);
            const status = error.status || 500;
            return res.status(status).json({ error: error.message || 'Failed to clear conversation.' });
        }
    }
}

module.exports = new ChatController();
