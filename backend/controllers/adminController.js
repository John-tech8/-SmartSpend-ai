// backend/controllers/adminController.js
const instructionService = require('../services/instructionService');

class AdminController {
    /**
     * GET /api/admin/instructions
     */
    async getInstructions(req, res) {
        try {
            const instruction = await instructionService.getActiveInstruction();
            return res.json({ instruction });
        } catch (error) {
            console.error('Error fetching instructions:', error);
            return res.status(500).json({ error: 'Failed to retrieve active instructions.' });
        }
    }

    /**
     * POST /api/admin/instructions
     */
    async updateInstructions(req, res) {
        try {
            const { systemPrompt, title, updatedBy = 'admin' } = req.body;

            if (!systemPrompt || typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
                return res.status(400).json({ error: 'System instruction prompt cannot be empty.' });
            }

            const updated = await instructionService.updateInstruction({
                title,
                systemPrompt,
                updatedBy
            });

            return res.json({
                success: true,
                message: 'Active instructions updated successfully.',
                instruction: updated
            });
        } catch (error) {
            console.error('Error updating instructions:', error);
            return res.status(500).json({ error: error.message || 'Failed to update instructions.' });
        }
    }

    /**
     * POST /api/admin/instructions/reset
     */
    async resetInstructions(req, res) {
        try {
            const { updatedBy = 'admin' } = req.body;
            const reset = await instructionService.resetToDefault(updatedBy);
            return res.json({
                success: true,
                message: 'Instructions reset to system defaults successfully.',
                instruction: reset
            });
        } catch (error) {
            console.error('Error resetting instructions:', error);
            return res.status(500).json({ error: 'Failed to reset instructions.' });
        }
    }

    /**
     * POST /api/admin/verify
     */
    async verifyAuth(req, res) {
        return res.json({ success: true, authorized: true });
    }
}

module.exports = new AdminController();
