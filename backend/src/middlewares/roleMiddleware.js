const prisma = require('../lib/prisma');

const requireRole = (...allowedRoles) => async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. Authentication required.'
        });
    }

    try {
        // Read the current role so role changes and deleted accounts take effect immediately.
        const user = await prisma.user.findUnique({ where: { id: Number(req.user.id) }, select: { role: true } });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Account no longer exists.' });
        }
        req.user.role = user.role;
    } catch (error) {
        return next(error);
    }

    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: `Access denied. Requires one of: ${allowedRoles.join(', ')}`
        });
    }

    next();
};

module.exports = {
    requireRole
};
