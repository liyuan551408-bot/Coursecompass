const express = require('express');
const router = express.Router();
const controller = require('../controllers/notificationController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.get('/', controller.getNotifications);
router.delete('/', controller.deleteAllNotifications);
router.patch('/read-all', controller.markAllNotificationsRead);
router.patch('/:id/read', controller.markNotificationRead);
router.delete('/:id', controller.deleteNotification);

module.exports = router;
