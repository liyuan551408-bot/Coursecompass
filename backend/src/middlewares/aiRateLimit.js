const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestWindows = new Map();
// Reclaim inactive clients even when they never send another request.
const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, window] of requestWindows) {
        if (window.startedAt <= cutoff) requestWindows.delete(key);
    }
}, WINDOW_MS);
// Background maintenance must not keep an otherwise idle process alive.
cleanupTimer.unref();

const aiRateLimit = (req, res, next) => {
    const now = Date.now();
    // Keep separate quotas for accounts sharing the same IP address.
    const key = `${req.ip}:${req.user?.id || 'anonymous'}`;
    const current = requestWindows.get(key);

    if (!current || now - current.startedAt >= WINDOW_MS) {
        requestWindows.set(key, { startedAt: now, count: 1 });
        return next();
    }

    if (current.count >= MAX_REQUESTS_PER_WINDOW) {
        const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000);
        res.set('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
            success: false,
            message: 'Too many AI requests. Please try again later.'
        });
    }

    current.count += 1;
    return next();
};

module.exports = {
    aiRateLimit
};
