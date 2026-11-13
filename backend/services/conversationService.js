// backend/services/conversationService.js
const db = require('../config/db');

class ConversationService {
    /**
     * Get or create the most recent active conversation for a user
     */
    async getOrCreateConversation(userId, title = 'Financial Chat') {
        if (!userId) {
            userId = 'guest';
        }

        const existingConversations = await db.getConversations(userId);
        if (existingConversations && existingConversations.length > 0) {
            return existingConversations[0];
        }

        return await db.createConversation(userId, title);
    }

    /**
     * Fetch conversation by ID with access control
     */
    async getConversation(conversationId, userId) {
        return await db.getConversation(conversationId, userId);
    }

    /**
     * List all conversations for a user
     */
    async getUserConversations(userId) {
        return await db.getConversations(userId);
    }

    /**
     * Get messages for a conversation with security check
     */
    async getMessages(conversationId, userId) {
        // Ensure conversation belongs to user if userId provided
        if (userId) {
            const conversation = await db.getConversation(conversationId, userId);
            if (!conversation) {
                const error = new Error('Conversation not found or access denied');
                error.status = 403;
                throw error;
            }
        }
        return await db.getMessages(conversationId);
    }

    /**
     * Add a message to a conversation
     */
    async addMessage({ conversationId, role, content, language, userId }) {
        if (userId) {
            const conversation = await db.getConversation(conversationId, userId);
            if (!conversation) {
                const error = new Error('Conversation not found or access denied');
                error.status = 403;
                throw error;
            }
        }

        return await db.saveMessage({
            conversationId,
            role,
            content,
            language
        });
    }

    /**
     * Delete / Clear conversation
     */
    async clearConversation(conversationId, userId) {
        if (userId) {
            const conversation = await db.getConversation(conversationId, userId);
            if (!conversation) {
                const error = new Error('Conversation not found or access denied');
                error.status = 403;
                throw error;
            }
        }
        return await db.deleteConversation(conversationId, userId);
    }
}

module.exports = new ConversationService();
