const prisma = require('../lib/prisma');

const getHealth = (_req, res) => res.status(200).json({ success: true, status: 'ok' });

const getDatabaseHealth = async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return res.status(200).json({ success: true, status: 'ok', database: 'ok' });
    } catch (error) {
        console.error('Database health check failed:', error.code || error.message);
        return res.status(503).json({ success: false, status: 'degraded', database: 'unavailable' });
    }
};

module.exports = { getHealth, getDatabaseHealth };
