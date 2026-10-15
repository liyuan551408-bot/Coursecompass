const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(verifyToken, requireRole('STUDENT'));
router.post('/', planController.createPlan);
router.get('/', planController.getMyPlans);
router.post('/:planId/courses', planController.addCourse);
router.delete('/:planId/courses/:courseId', planController.removeCourse);
router.delete('/:planId', planController.deletePlan);

module.exports = router;
