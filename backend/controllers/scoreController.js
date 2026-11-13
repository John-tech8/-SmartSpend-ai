// backend/controllers/scoreController.js
const scoreService = require('../services/scoreService');

class ScoreController {
    /**
     * GET /api/financial-health/score
     */
    async getScore(req, res) {
        try {
            const userId = req.userId;
            const scoreData = await scoreService.calculateScore(userId);
            return res.json({ success: true, data: scoreData });
        } catch (error) {
            console.error('Error in getScore controller:', error);
            return res.status(500).json({ error: error.message || 'Failed to calculate financial health score.' });
        }
    }

    /**
     * GET /api/financial-health/history
     */
    async getHistory(req, res) {
        try {
            const userId = req.userId;
            const limit = parseInt(req.query.limit || '10', 10);
            const history = await scoreService.getHistory(userId, Math.min(50, Math.max(1, limit)));
            return res.json({ success: true, data: history });
        } catch (error) {
            console.error('Error in getHistory controller:', error);
            return res.status(500).json({ error: error.message || 'Failed to retrieve financial health history.' });
        }
    }
}

module.exports = new ScoreController();
