// backend/config/db.js
const { createClient } = require('@supabase/supabase-js');
const { DEFAULT_SYSTEM_PROMPT } = require('../utils/prompts');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;
let isConfigured = false;

if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false
            }
        });
        isConfigured = true;
        console.log("✅ Supabase PostgreSQL client initialized successfully.");
    } catch (err) {
        console.error("⚠️ Failed to initialize Supabase client:", err.message);
    }
} else {
    console.warn("⚠️ SUPABASE_URL / SUPABASE_ANON_KEY not set in .env. Operating in resilient storage fallback mode.");
}

// In-memory fallback cache for development/offline testing
const memoryStore = {
    conversations: new Map(), // id -> conversation
    messages: new Map(),      // id -> message
    activeInstruction: {
        id: 'default-instruction-uuid',
        title: 'Default Financial Coach Instructions',
        system_prompt: DEFAULT_SYSTEM_PROMPT,
        is_active: true,
        updated_by: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
};

/**
 * Helper to generate simple UUID-like string if crypto.randomUUID isn't available
 */
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// DB Operations Layer
const db = {
    isConfigured: () => isConfigured,
    getClient: () => supabase,

    // Conversations
    async createConversation(userId, title = 'New Conversation') {
        const now = new Date().toISOString();
        const id = generateId();

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('conversations')
                    .insert([{ id, user_id: userId, title, created_at: now, updated_at: now }])
                    .select()
                    .single();

                if (error) {
                    console.error("Database error creating conversation, falling back:", error.message);
                } else if (data) {
                    return data;
                }
            } catch (err) {
                console.error("Exception in createConversation:", err.message);
            }
        }

        // Resilient in-memory fallback
        const record = { id, user_id: userId, title, created_at: now, updated_at: now };
        memoryStore.conversations.set(id, record);
        return record;
    },

    async getConversations(userId) {
        if (supabase && userId) {
            try {
                const { data, error } = await supabase
                    .from('conversations')
                    .select('*')
                    .eq('user_id', userId)
                    .order('updated_at', { ascending: false });

                if (!error && data) {
                    return data;
                }
            } catch (err) {
                console.error("Exception in getConversations:", err.message);
            }
        }

        // Fallback filter
        const list = Array.from(memoryStore.conversations.values())
            .filter(c => !userId || c.user_id === userId)
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        return list;
    },

    async getConversation(conversationId, userId) {
        if (supabase) {
            try {
                let query = supabase.from('conversations').select('*').eq('id', conversationId);
                if (userId) {
                    query = query.eq('user_id', userId);
                }
                const { data, error } = await query.single();
                if (!error && data) return data;
            } catch (err) {
                console.error("Exception in getConversation:", err.message);
            }
        }

        const conv = memoryStore.conversations.get(conversationId);
        if (conv && (!userId || conv.user_id === userId)) {
            return conv;
        }
        return null;
    },

    async updateConversationTimestamp(conversationId) {
        const now = new Date().toISOString();
        if (supabase) {
            try {
                await supabase
                    .from('conversations')
                    .update({ updated_at: now })
                    .eq('id', conversationId);
            } catch (err) {
                console.error("Error updating conversation timestamp:", err.message);
            }
        }
        const conv = memoryStore.conversations.get(conversationId);
        if (conv) {
            conv.updated_at = now;
        }
    },

    async deleteConversation(conversationId, userId) {
        if (supabase) {
            try {
                let query = supabase.from('conversations').delete().eq('id', conversationId);
                if (userId) query = query.eq('user_id', userId);
                await query;
            } catch (err) {
                console.error("Error deleting conversation:", err.message);
            }
        }

        memoryStore.conversations.delete(conversationId);
        for (const [id, msg] of memoryStore.messages.entries()) {
            if (msg.conversation_id === conversationId) {
                memoryStore.messages.delete(id);
            }
        }
        return true;
    },

    // Messages
    async saveMessage({ conversationId, role, content, language = 'en' }) {
        const now = new Date().toISOString();
        const id = generateId();
        const messageData = {
            id,
            conversation_id: conversationId,
            role,
            content,
            language,
            created_at: now
        };

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('messages')
                    .insert([messageData])
                    .select()
                    .single();

                if (!error && data) {
                    await this.updateConversationTimestamp(conversationId);
                    return data;
                }
                console.error("Database error saving message:", error?.message);
            } catch (err) {
                console.error("Exception in saveMessage:", err.message);
            }
        }

        memoryStore.messages.set(id, messageData);
        await this.updateConversationTimestamp(conversationId);
        return messageData;
    },

    async getMessages(conversationId) {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('conversation_id', conversationId)
                    .order('created_at', { ascending: true });

                if (!error && data) {
                    return data;
                }
            } catch (err) {
                console.error("Exception in getMessages:", err.message);
            }
        }

        const msgs = Array.from(memoryStore.messages.values())
            .filter(m => m.conversation_id === conversationId)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        return msgs;
    },

    // AI Instructions
    async getActiveInstruction() {
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('ai_instructions')
                    .select('*')
                    .eq('is_active', true)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!error && data) {
                    return data;
                }
            } catch (err) {
                console.error("Exception in getActiveInstruction:", err.message);
            }
        }

        return memoryStore.activeInstruction;
    },

    async updateInstruction({ title, systemPrompt, updatedBy = 'admin' }) {
        const now = new Date().toISOString();
        const id = generateId();

        if (supabase) {
            try {
                // Deactivate prior instructions
                await supabase
                    .from('ai_instructions')
                    .update({ is_active: false })
                    .eq('is_active', true);

                const { data, error } = await supabase
                    .from('ai_instructions')
                    .insert([{
                        id,
                        title: title || 'Admin Custom Instructions',
                        system_prompt: systemPrompt,
                        is_active: true,
                        updated_by: updatedBy,
                        created_at: now,
                        updated_at: now
                    }])
                    .select()
                    .single();

                if (!error && data) {
                    return data;
                }
                console.error("Error updating instruction in Supabase:", error?.message);
            } catch (err) {
                console.error("Exception in updateInstruction:", err.message);
            }
        }

        memoryStore.activeInstruction = {
            id,
            title: title || 'Admin Custom Instructions',
            system_prompt: systemPrompt,
            is_active: true,
            updated_by: updatedBy,
            created_at: now,
            updated_at: now
        };
        return memoryStore.activeInstruction;
    },

    async resetInstruction(updatedBy = 'admin') {
        return this.updateInstruction({
            title: 'Default Financial Coach Instructions',
            systemPrompt: DEFAULT_SYSTEM_PROMPT,
            updatedBy
        });
    }
};

module.exports = db;
