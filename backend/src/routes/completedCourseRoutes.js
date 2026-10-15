const express = require('express');
const controller = require('../controllers/completedCourseController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

const router = express.Router();
router.use(verifyToken, requireRole('STUDENT'));
router.get('/', controller.getMyCompletedCourses);
router.put('/', controller.markCourseCompleted);
router.delete('/:courseId', controller.unmarkCourseCompleted);

module.exports = router;
