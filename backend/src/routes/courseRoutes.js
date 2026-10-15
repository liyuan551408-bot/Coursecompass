const express = require('express');
const router = express.Router();

const courseController = require('../controllers/courseController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.get('/', courseController.getCourses);
router.get('/admin/all', verifyToken, requireRole('ADMIN'), courseController.getAdminCourses);

router.post('/', verifyToken, requireRole('ADMIN'), courseController.createCourse);
router.patch('/:id', verifyToken, requireRole('ADMIN'), courseController.updateCourse);

router.post('/compare', courseController.compareCourses);

router.get('/search', courseController.searchCourses);

router.get('/:id', (req, res, next) => {
    if (/^\d+$/.test(req.params.id)) {
        return courseController.getCourseById(req, res);
    }
    next();
});

router.get('/:code', courseController.getCourseByCode);

module.exports = router;
