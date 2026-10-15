const completedCourseService = require('../services/completedCourseService');

const handleError = (res, error, action) => {
    if (error instanceof TypeError) {
        return res.status(400).json({ success: false, message: error.message });
    }
    if (error?.code === 'P2003') {
        return res.status(404).json({ success: false, message: 'Course not found' });
    }
    console.error(`${action} completed course error:`, error);
    return res.status(500).json({ success: false, message: 'Server Error' });
};

const getMyCompletedCourses = async (req, res) => {
    try {
        const records = await completedCourseService.getCompletedCoursesByUser(Number(req.user.id));
        return res.status(200).json({ success: true, data: records });
    } catch (error) {
        return handleError(res, error, 'List');
    }
};

const markCourseCompleted = async (req, res) => {
    try {
        const record = await completedCourseService.markCourseCompleted(
            Number(req.user.id),
            Number(req.body.courseId),
            req.body.completedAt
        );
        return res.status(200).json({ success: true, data: record });
    } catch (error) {
        return handleError(res, error, 'Mark');
    }
};

const unmarkCourseCompleted = async (req, res) => {
    try {
        const removed = await completedCourseService.unmarkCourseCompleted(
            Number(req.user.id),
            Number(req.params.courseId)
        );
        return res.status(removed ? 200 : 404).json({
            success: removed,
            message: removed ? 'Course removed from completed courses' : 'Completed course not found'
        });
    } catch (error) {
        return handleError(res, error, 'Unmark');
    }
};

module.exports = { getMyCompletedCourses, markCourseCompleted, unmarkCourseCompleted };
