// backend/middleware/auth.js

/**
 * Middleware to verify administrator authorization
 */
function requireAdmin(req, res, next) {
    const adminSecret = process.env.ADMIN_SECRET || 'smartspend-admin-2026';

    const providedKey = req.headers['x-admin-key'] ||
        (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, '')) ||
        req.query.admin_key;

    if (!providedKey || providedKey !== adminSecret) {
        return res.status(403).json({
            error: 'Access denied: Valid administrator authorization key is required.'
        });
    }

    next();
}

module.exports = {
    requireAdmin
};
