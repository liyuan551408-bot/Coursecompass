const plannerService = require('../services/planService');
const { parsePositiveInteger } = require('../utils/validation');

const createPlan = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, year, semester } = req.body;

        if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
            return res.status(400).json({ success: false, message: 'Name, year, and semester are required' });
        }
        if (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 2100) {
            return res.status(400).json({ success: false, message: 'Year must be a whole number between 2000 and 2100' });
        }
        if (!['SEMESTER_1', 'SEMESTER_2', 'SUMMER'].includes(semester)) {
            return res.status(400).json({ success: false, message: 'Semester must be SEMESTER_1, SEMESTER_2, or SUMMER' });
        }

        const plan = await plannerService.createPlan(userId, req.body);
        res.status(201).json({ success: true, message: 'Plan created successfully', data: plan });
    } catch (error) {

        if (error.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'A plan with this name already exists for this semester' });
        }
        console.error('Create Plan Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const getMyPlans = async (req, res) => {
    try {
        const userId = req.user.id;
        const plans = await plannerService.getUserPlans(userId);
        res.status(200).json({ success: true, data: plans });
    } catch (error) {
        console.error('Get Plans Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const addCourse = async (req, res) => {
    try {
        const userId = req.user.id;
        const planId = req.params.planId;
        const { courseId } = req.body; 

        if (!Number.isInteger(Number(courseId)) || Number(courseId) <= 0) {
            return res.status(400).json({ success: false, message: 'courseId is required' });
        }
        if (!/^\d+$/.test(String(planId)) || Number(planId) <= 0) {
            return res.status(400).json({ success: false, message: 'A valid plan id is required' });
        }

        const result = await plannerService.addCourseToPlan(userId, planId, courseId, {
            confirmPrerequisites: req.body.confirmPrerequisites !== false,
        });

        res.status(201).json({ 
            success: true, 
            message: 'Course added to plan', 
            warnings: result.warnings,
            requiresConfirmation: result.requiresConfirmation === true,
            data: result.course
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'This course is already in the plan' });
        }
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }
        console.error('Add Course Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const removeCourse = async (req, res) => {
    try {
        const planId = parsePositiveInteger(req.params.planId);
        const courseId = parsePositiveInteger(req.params.courseId);
        if (planId === null || courseId === null) {
            return res.status(400).json({ success: false, message: 'Valid plan and course ids are required' });
        }

        await plannerService.removeCourseFromPlan(req.user.id, planId, courseId);
        return res.status(200).json({ success: true, message: 'Course removed from plan' });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
        if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Plan course not found' });
        console.error('Remove Course Error:', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const deletePlan = async (req, res) => {
    try {
        const planId = parsePositiveInteger(req.params.planId);
        if (planId === null) {
            return res.status(400).json({ success: false, message: 'A valid plan id is required' });
        }

        await plannerService.deletePlan(req.user.id, planId);
        return res.status(200).json({ success: true, message: 'Plan deleted' });
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
        console.error('Delete Plan Error:', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    createPlan,
    getMyPlans,
    addCourse,
    removeCourse,
    deletePlan
};
