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
    incomes: new Map(),       // id -> income
    expenses: new Map(),      // id -> expense
    budgets: new Map(),       // id -> budget
    goals: new Map(),         // id -> goal
    financial_health_history: new Map(), // id -> snapshot
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

        return Array.from(memoryStore.conversations.values())
            .filter(c => !userId || c.user_id === userId)
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
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

        return Array.from(memoryStore.messages.values())
            .filter(m => m.conversation_id === conversationId)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    },

    // -------------------------------------------------------------
    // FINANCIAL DATA: Incomes, Expenses, Budgets, Goals, Snapshots
    // -------------------------------------------------------------

    async getIncomes(userId, startDate = null, endDate = null) {
        if (!userId) return [];
        if (supabase) {
            try {
                let query = supabase.from('incomes').select('*').eq('user_id', userId);
                if (startDate) query = query.gte('date', startDate);
                if (endDate) query = query.lte('date', endDate);
                const { data, error } = await query.order('date', { ascending: false });
                if (!error && data) return data;
            } catch (err) {
                console.error("Exception in getIncomes:", err.message);
            }
        }

        // Memory fallback
        return Array.from(memoryStore.incomes.values()).filter(inc => {
            if (inc.user_id !== userId) return false;
            const incDate = inc.date || inc.created_at?.slice(0, 10);
            if (startDate && incDate < startDate) return false;
            if (endDate && incDate > endDate) return false;
            return true;
        }).sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
    },

    async addIncome({ userId, amount, category = 'Salary', date = null, source = 'Income' }) {
        const id = generateId();
        const now = new Date().toISOString();
        const record = {
            id,
            user_id: userId,
            amount: Number(amount),
            date: date || now.slice(0, 10),
            source,
            created_at: now
        };

        if (supabase) {
            try {
                const { data, error } = await supabase.from('incomes').insert([record]).select().single();
                if (!error && data) return data;
            } catch (err) {
                console.error("Exception in addIncome:", err.message);
            }
        }

        memoryStore.incomes.set(id, record);
        return record;
    },

    async getExpenses(userId, startDate = null, endDate = null) {
        if (!userId) return [];
        if (supabase) {
            try {
                let query = supabase.from('expenses').select('*').eq('user_id', userId);
                if (startDate) query = query.gte('date', startDate);
                if (endDate) query = query.lte('date', endDate);
                const { data, error } = await query.order('date', { ascending: false });
                if (!error && data) return data;
            } catch (err) {
                console.error("Exception in getExpenses:", err.message);
            }
        }

        return Array.from(memoryStore.expenses.values()).filter(exp => {
            if (exp.user_id !== userId) return false;
            const expDate = exp.date || exp.created_at?.slice(0, 10);
            if (startDate && expDate < startDate) return false;
            if (endDate && expDate > endDate) return false;
            return true;
        }).sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
    },

    async addExpense({ userId, category, amount, date = null }) {
        const id = generateId();
        const now = new Date().toISOString();
        const record = {
            id,
            user_id: userId,
            category: category || 'Others',
            amount: Number(amount),
            date: date || now.slice(0, 10),
            created_at: now
        };

        if (supabase) {
            try {
                const { data, error } = await supabase.from('expenses').insert([record]).select().single();
                if (!error && data) return data;
            } catch (err) {
                console.error("Exception in addExpense:", err.message);
            }
        }

        memoryStore.expenses.set(id, record);
        return record;
    },

    async getBudgets(userId, month = null) {
        if (!userId) return [];
        if (supabase) {
            try {
                let query = supabase.from('budgets').select('*').eq('user_id', userId);
                if (month) {
                    query = query.or(`month.eq.${month},month.is.null`);
                }
                const { data, error } = await query;
                if (!error && data) return data;
            } catch (err) {
                console.warn("Budgets table query, falling back to memory:", err.message);
            }
        }

        return Array.from(memoryStore.budgets.values()).filter(b => {
            if (b.user_id !== userId) return false;
            if (month && b.month && b.month !== month) return false;
            return true;
        });
    },

    async setBudget({ userId, category, monthlyLimit, month = null }) {
        const id = generateId();
        const now = new Date().toISOString();
        const record = {
            id,
            user_id: userId,
            category,
            monthly_limit: Number(monthlyLimit),
            month,
            created_at: now,
            updated_at: now
        };

        if (supabase) {
            try {
                const { data, error } = await supabase.from('budgets').upsert([record]).select().single();
                if (!error && data) return data;
            } catch (err) {
                console.warn("Supabase setBudget, falling back to memory:", err.message);
            }
        }

        memoryStore.budgets.set(id, record);
        return record;
    },

    async getGoals(userId) {
        if (!userId) return [];
        if (supabase) {
            try {
                const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId);
                if (!error && data) return data;
            } catch (err) {
                console.error("Exception in getGoals:", err.message);
            }
        }

        return Array.from(memoryStore.goals.values()).filter(g => g.user_id === userId);
    },

    async addGoal({ userId, name, targetAmount, currentAmount = 0, targetDate = null }) {
        const id = generateId();
        const now = new Date().toISOString();
        const record = {
            id,
            user_id: userId,
            name,
            target_amount: Number(targetAmount),
            current_amount: Number(currentAmount),
            target_date: targetDate || now.slice(0, 10),
            created_at: now
        };

        if (supabase) {
            try {
                const { data, error } = await supabase.from('goals').insert([record]).select().single();
                if (!error && data) return data;
            } catch (err) {
                console.error("Exception in addGoal:", err.message);
            }
        }

        memoryStore.goals.set(id, record);
        return record;
    },

    async saveHealthScoreSnapshot(snapshot) {
        const id = generateId();
        const now = new Date().toISOString();
        const record = {
            id,
            user_id: snapshot.userId,
            score: Number(snapshot.score),
            classification: snapshot.classification,
            component_scores: snapshot.componentScores,
            earned_points: Number(snapshot.earnedPoints),
            available_points: Number(snapshot.availablePoints),
            data_completeness: snapshot.dataCompleteness || 'medium',
            calculated_at: now
        };

        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('financial_health_history')
                    .insert([record])
                    .select()
                    .single();

                if (!error && data) return data;
            } catch (err) {
                console.warn("Exception in saveHealthScoreSnapshot, storing in memory:", err.message);
            }
        }

        memoryStore.financial_health_history.set(id, record);
        return record;
    },

    async getHealthScoreHistory(userId, limit = 10) {
        if (!userId) return [];
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('financial_health_history')
                    .select('*')
                    .eq('user_id', userId)
                    .order('calculated_at', { ascending: false })
                    .limit(limit);

                if (!error && data) return data;
            } catch (err) {
                console.warn("Exception in getHealthScoreHistory:", err.message);
            }
        }

        return Array.from(memoryStore.financial_health_history.values())
            .filter(s => s.user_id === userId)
            .sort((a, b) => new Date(b.calculated_at) - new Date(a.calculated_at))
            .slice(0, limit);
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
