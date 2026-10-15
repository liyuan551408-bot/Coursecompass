const prisma = require('../lib/prisma');

const createNotifications = async (userIds, data) => {
    const ids = [...new Set(userIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) return { count: 0 };
    return prisma.notification.createMany({
        data: ids.map((userId) => ({ userId, type: data.type, title: data.title, message: data.message }))
    });
};

const createNotificationsSafely = async (userIds, data) => {
    try {
        return await createNotifications(userIds, data);
    } catch (error) {
        console.error('Notification creation failed:', error);
        return { count: 0, error };
    }
};

const listForUser = async (userId, { unreadOnly = false, page = 1, limit = 20 } = {}) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
    const where = { userId: Number(userId), ...(unreadOnly ? { readAt: null } : {}) };
    const [items, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (safePage - 1) * safeLimit, take: safeLimit }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId: Number(userId), readAt: null } })
    ]);
    return { items, total, unreadCount, page: safePage, limit: safeLimit };
};

const markRead = async (userId, notificationId) => prisma.notification.updateMany({
    where: { id: Number(notificationId), userId: Number(userId) }, data: { readAt: new Date() }
});

const markAllRead = (userId) => prisma.notification.updateMany({
    where: { userId: Number(userId), readAt: null }, data: { readAt: new Date() }
});

const deleteOne = (userId, notificationId) => prisma.notification.deleteMany({
    where: { id: Number(notificationId), userId: Number(userId) }
});

const deleteAll = (userId) => prisma.notification.deleteMany({ where: { userId: Number(userId) } });

const deleteExpired = (days = 180) => prisma.notification.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - days * 86400000) } }
});

module.exports = { createNotificationsSafely, listForUser, markRead, markAllRead, deleteOne, deleteAll, deleteExpired };
