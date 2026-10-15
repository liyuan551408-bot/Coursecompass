const notificationService = require('../services/notificationService');
const { parsePositiveInteger } = require('../utils/validation');

const getNotifications = async (req, res) => {
    try {
        const page = req.query.page === undefined ? 1 : parsePositiveInteger(req.query.page);
        const limit = req.query.limit === undefined ? 20 : parsePositiveInteger(req.query.limit);

        if (page === null || limit === null || limit > 50) {
            return res.status(400).json({
                success: false,
                message: 'page and limit must be positive integers, and limit cannot exceed 50'
            });
        }

        const unreadOnly = String(req.query.unreadOnly) === 'true';
        const data = await notificationService.listForUser(req.user.id, { unreadOnly, page, limit });
        return res.json({ success: true, ...data });
    } catch (error) {
        console.error('Notification query failed:', error);
        return res.status(500).json({ success: false, message: 'Unable to load notifications' });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        const notificationId = parsePositiveInteger(req.params.id);
        if (notificationId === null) {
            return res.status(400).json({ success: false, message: 'Invalid notification id' });
        }

        const result = await notificationService.markRead(req.user.id, notificationId);
        return res.json({ success: true, updated: result.count > 0 });
    } catch (error) {
        console.error('Notification read update failed:', error);
        return res.status(500).json({ success: false, message: 'Unable to update notification' });
    }
};

const markAllNotificationsRead = async (req, res) => {
    try {
        const result = await notificationService.markAllRead(req.user.id);
        return res.json({ success: true, updated: result.count });
    } catch (error) {
        console.error('All notifications read update failed:', error);
        return res.status(500).json({ success: false, message: 'Unable to update notifications' });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const notificationId = parsePositiveInteger(req.params.id);
        if (notificationId === null) {
            return res.status(400).json({ success: false, message: 'Invalid notification id' });
        }

        const result = await notificationService.deleteOne(req.user.id, notificationId);
        return res.json({ success: true, deleted: result.count > 0 });
    } catch (error) {
        console.error('Notification delete failed:', error);
        return res.status(500).json({ success: false, message: 'Unable to delete notification' });
    }
};

const deleteAllNotifications = async (req, res) => {
    try {
        const result = await notificationService.deleteAll(req.user.id);
        return res.json({ success: true, deleted: result.count });
    } catch (error) {
        console.error('All notifications delete failed:', error);
        return res.status(500).json({ success: false, message: 'Unable to delete notifications' });
    }
};

module.exports = { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification, deleteAllNotifications };
