const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

const studentOnly = [verifyToken, requireRole('STUDENT')];
const moderationRoles = [verifyToken, requireRole('MODERATOR', 'ADMIN')];

router.get('/course/:courseId', reviewController.getCourseReviews);

router.get('/course/:courseId/summary', reviewController.getCourseRatingSummary);

router.get('/mine/course/:courseId', ...studentOnly, reviewController.getMyCourseReview);

router.post('/', ...studentOnly, reviewController.addReview);

router.put('/course/:courseId', ...studentOnly, reviewController.updateReview);

router.get('/pending', ...moderationRoles, reviewController.getPendingReviews);

router.get('/reports/pending', ...moderationRoles, reviewController.getPendingReports);
router.get('/moderation/counts', ...moderationRoles, reviewController.getModerationQueueCounts);
router.patch('/reports/:id/status', ...moderationRoles, reviewController.updateReportStatus);

router.post('/:id/report', ...studentOnly, reviewController.reportReview);

router.patch('/:id/status', ...moderationRoles, reviewController.moderateReview);

module.exports = router;
