const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const { aiRateLimit } = require('../middlewares/aiRateLimit');

router.use(verifyToken);
router.use(aiRateLimit);
router.post('/test-embedding', requireRole('ADMIN'), aiController.testEmbedding);
router.post('/semantic-search', aiController.semanticSearch);
router.post('/recommend', requireRole('STUDENT'), aiController.aiRecommendCourses);
router.post('/compare', aiController.compareCoursesWithAi);
router.get('/courses/:id/summary', aiController.getCourseSummary);

module.exports = router;
