// backend/services/aiService.js
const axios = require('axios');
const Groq = require('groq-sdk');

class AIService {
    constructor() {
        this.xaiBaseUrl = 'https://api.x.ai/v1/chat/completions';
    }

    /**
     * Get configured xAI model or fallback
     */
    getModel() {
        return process.env.XAI_MODEL || 'grok-beta';
    }

    /**
     * Generate response from xAI Grok (with fallback to Groq if XAI key is unset)
     * @param {Object} params
     * @param {string} params.systemPrompt - Current active system instructions
     * @param {Array} params.history - Previous messages [{ role: 'user'|'assistant', content: string }]
     * @param {string} params.userMessage - Current user message
     * @param {string} params.language - Selected language ('en', 'hi', 'ta')
     * @returns {Promise<string>}
     */
    async generateResponse({ systemPrompt, history = [], userMessage, language = 'en' }) {
        const xaiKey = process.env.XAI_API_KEY;
        const groqKey = process.env.GROQ_API_KEY;

        // Build messages array
        const messages = [];

        // 1. Dynamic System prompt
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }

        // 2. Conversation context (limit to last 10 messages for token safety)
        const recentHistory = (history || []).slice(-10);
        for (const msg of recentHistory) {
            if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }

        // 3. User message
        messages.push({
            role: 'user',
            content: userMessage
        });

        // Preferred: xAI Grok API
        if (xaiKey) {
            try {
                const model = this.getModel();
                const response = await axios.post(
                    this.xaiBaseUrl,
                    {
                        model,
                        messages,
                        temperature: 0.5,
                        max_tokens: 1024
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${xaiKey}`
                        },
                        timeout: 30000 // 30-second timeout
                    }
                );

                const reply = response.data?.choices?.[0]?.message?.content;
                if (!reply) {
                    throw new Error('Invalid or empty response format received from xAI Grok API.');
                }
                return reply.trim();
            } catch (error) {
                console.error('xAI Grok API Error:', error.response?.status, error.response?.data || error.message);
                if (error.response?.status === 401) {
                    throw new Error('xAI API authentication failed. Please verify your XAI_API_KEY.');
                } else if (error.response?.status === 429) {
                    throw new Error('xAI rate limit reached. Please wait a moment before trying again.');
                } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                    throw new Error('xAI request timed out. Please try again.');
                }
                // If xAI failed and Groq is present, attempt fallback
                if (!groqKey) {
                    throw new Error(error.response?.data?.error?.message || 'Error communicating with xAI Grok service.');
                }
                console.warn('Falling back to secondary provider due to xAI failure...');
            }
        }

        // Fallback: Groq SDK if GROQ_API_KEY is configured
        if (groqKey) {
            try {
                const groq = new Groq({ apiKey: groqKey });
                const groqResponse = await groq.chat.completions.create({
                    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
                    messages
                });
                const reply = groqResponse.choices?.[0]?.message?.content;
                if (reply) return reply.trim();
            } catch (err) {
                console.error('Groq fallback error:', err.message);
                throw new Error('AI service is temporarily unavailable. Please check backend API keys.');
            }
        }

        // If neither key is provided
        return "I'm Mini Buddy 🤖! My AI connection is not yet configured. Please set the XAI_API_KEY in your backend .env file to enable live Grok responses.";
    }
}

module.exports = new AIService();
