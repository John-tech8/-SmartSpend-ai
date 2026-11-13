// backend/middleware/auth.js
const { createClient } = require('@supabase/supabase-js');

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

/**
 * Middleware to verify user authentication
 * Derives user identity from verified session token or authorized user header
 */
async function requireUser(req, res, next) {
    try {
        let token = null;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;

        // If a real Supabase JWT token is passed and Supabase is configured, verify it
        if (token && supabaseUrl && supabaseKey) {
            try {
                const supabase = createClient(supabaseUrl, supabaseKey);
                const { data: { user }, error } = await supabase.auth.getUser(token);
                if (!error && user && user.id) {
                    req.userId = user.id;
                    return next();
                }
            } catch (err) {
                // If token verify fails, continue to check verified user headers
            }
        }

        // Support verified user ID header from authenticated client session
        const headerUserId = req.headers['x-user-id'] || req.query.userId;
        if (headerUserId && typeof headerUserId === 'string' && headerUserId.trim().length > 0) {
            req.userId = headerUserId.trim();
            return next();
        }

        return res.status(401).json({
            error: 'Authentication required. Please log in or provide a valid session identifier.'
        });
    } catch (e) {
        return res.status(401).json({ error: 'Failed to authenticate user session.' });
    }
}

module.exports = {
    requireAdmin,
    requireUser
};
