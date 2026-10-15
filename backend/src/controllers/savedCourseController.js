const savedCourseService = require('../services/savedCourseService');
const { parsePositiveInteger } = require('../utils/validation');

const addCourse = async (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = parsePositiveInteger(req.body?.courseId);

        if (courseId === null) {
            return res.status(400).json({ success: false, message: 'courseId must be a positive integer' });
        }

        const saved = await savedCourseService.addSavedCourse(userId, courseId);
        res.status(201).json({ success: true, data: saved });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'Course already saved' });
        }
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        console.error('Add Saved Course Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const getMyCourses = async (req, res) => {
    try {
        const courses = await savedCourseService.getMySavedCourses(req.user.id);
        res.status(200).json({ success: true, data: courses });
    } catch (error) {
        console.error('Get Saved Courses Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const removeCourse = async (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = parsePositiveInteger(req.params.courseId);

        if (courseId === null) {
            return res.status(400).json({ success: false, message: 'courseId must be a positive integer' });
        }

        await savedCourseService.removeSavedCourse(userId, courseId);
        res.status(200).json({ success: true, message: 'Course removed from saved list' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Saved course not found' });
        }
        console.error('Remove Saved Course Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = {
    addCourse,
    getMyCourses,
    removeCourse
};
