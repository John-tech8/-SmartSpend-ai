// backend/controllers/analyticsController.js
const analyticsService = require('../services/analyticsService');

class AnalyticsController {
    /**
     * GET /api/analytics/overview
     */
    async getOverview(req, res) {
        try {
            const userId = req.userId;
            const { range = 'current_month', startDate, endDate } = req.query;

            // Validate custom date formats if provided
            if (range === 'custom') {
                if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
                    return res.status(400).json({ error: 'Custom range requires valid startDate and endDate in YYYY-MM-DD format.' });
                }
            }

            const data = await analyticsService.getOverview(userId, { range, startDate, endDate });
            return res.json({ success: true, data });
        } catch (error) {
            console.error('Error in getOverview controller:', error);
            return res.status(500).json({ error: error.message || 'Failed to calculate expense overview.' });
        }
    }

    /**
     * GET /api/analytics/categories
     */
    async getCategories(req, res) {
        try {
            const userId = req.userId;
            const { range = 'current_month', startDate, endDate } = req.query;

            const data = await analyticsService.getCategoryAnalysis(userId, { range, startDate, endDate });
            return res.json({ success: true, data });
        } catch (error) {
            console.error('Error in getCategories controller:', error);
            return res.status(500).json({ error: error.message || 'Failed to calculate category analysis.' });
        }
    }

    /**
     * GET /api/analytics/monthly-comparison
     */
    async getMonthlyComparison(req, res) {
        try {
            const userId = req.userId;
            const data = await analyticsService.getMonthlyComparison(userId);
            return res.json({ success: true, data });
        } catch (error) {
            console.error('Error in getMonthlyComparison controller:', error);
            return res.status(500).json({ error: error.message || 'Failed to calculate monthly comparison.' });
        }
    }

    /**
     * GET /api/analytics/trends
     */
    async getTrends(req, res) {
        try {
            const userId = req.userId;
            const monthsBack = parseInt(req.query.months || '6', 10);
            const data = await analyticsService.getTrends(userId, Math.min(12, Math.max(1, monthsBack)));
            return res.json({ success: true, data });
        } catch (error) {
            console.error('Error in getTrends controller:', error);
            return res.status(500).json({ error: error.message || 'Failed to calculate trends.' });
        }
    }

    /**
     * GET /api/analytics/ai-insights
     */
    async getAIInsights(req, res) {
        try {
            const userId = req.userId;
            const data = await analyticsService.getAIInsights(userId);
            return res.json({ success: true, data });
        } catch (error) {
            console.error('Error in getAIInsights controller:', error);
            return res.status(500).json({ error: error.message || 'Failed to generate financial insights.' });
        }
    }

    /**
     * GET /api/analytics/behaviour
     */
    async getBehaviour(req, res) {
        try {
            const userId = req.userId;
            const data = await analyticsService.getSpendingBehaviour(userId);
            return res.json({ success: true, data });
        } catch (error) {
            console.error('Error in getBehaviour controller:', error);
            return res.status(500).json({ error: error.message || 'Failed to analyze spending behaviour.' });
        }
    }
}

module.exports = new AnalyticsController();
