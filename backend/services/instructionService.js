// backend/services/instructionService.js
const db = require('../config/db');
const { DEFAULT_SYSTEM_PROMPT, LANGUAGE_INSTRUCTIONS } = require('../utils/prompts');

class InstructionService {
    /**
     * Get active system prompt instruction
     */
    async getActiveInstruction() {
        const record = await db.getActiveInstruction();
        return record || {
            title: 'Default Financial Coach Instructions',
            system_prompt: DEFAULT_SYSTEM_PROMPT,
            is_active: true
        };
    }

    /**
     * Build the dynamic system prompt including language specification
     */
    async buildSystemPrompt(language = 'en') {
        const instruction = await this.getActiveInstruction();
        const basePrompt = instruction.system_prompt || DEFAULT_SYSTEM_PROMPT;
        const langRule = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;

        return `${basePrompt}\n\nCURRENT LANGUAGE INSTRUCTION:\n${langRule}`;
    }

    /**
     * Save new administrator system instruction
     */
    async updateInstruction({ title, systemPrompt, updatedBy = 'admin' }) {
        if (!systemPrompt || typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
            throw new Error('Instruction content cannot be empty.');
        }

        return await db.updateInstruction({
            title: title || 'Admin Custom Instructions',
            systemPrompt: systemPrompt.trim(),
            updatedBy
        });
    }

    /**
     * Reset instructions to defaults
     */
    async resetToDefault(updatedBy = 'admin') {
        return await db.resetInstruction(updatedBy);
    }
}

module.exports = new InstructionService();
