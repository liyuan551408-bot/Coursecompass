const courseService = require('../services/courseService');

const COURSE_SEMESTERS = new Set(['SEMESTER_1', 'SEMESTER_2', 'SUMMER']);
const ASSESSMENT_TYPES = new Set(['EXAM', 'ASSIGNMENT', 'QUIZ', 'PROJECT', 'LAB', 'PRESENTATION']);

const normalizeCoursePayload = (body, { partial = false } = {}) => {
    const data = {};
    for (const [field, maxLength] of Object.entries({ name: 200, code: 40, description: 5000 })) {
        if (body[field] === undefined && partial) continue;
        if (body[field] === undefined || body[field] === null) {
            if (field === 'description') data[field] = null;
            continue;
        }
        if (typeof body[field] !== 'string') throw new TypeError(`${field} must be text`);
        const value = body[field].trim();
        if ((field === 'name' || field === 'code') && !value) throw new TypeError(`${field} is required`);
        if (value.length > maxLength) throw new TypeError(`${field} is too long`);
        data[field] = field === 'code' ? value.toUpperCase() : (value || null);
    }

    if (body.credits !== undefined || !partial) {
        const credits = Number(body.credits);
        if (!Number.isInteger(credits) || credits <= 0) throw new TypeError('Credits must be a positive whole number');
        data.credits = credits;
    }
    for (const field of ['workloadHours', 'level']) {
        if (body[field] === undefined) continue;
        if (body[field] === null || body[field] === '') {
            data[field] = null;
            continue;
        }
        const value = Number(body[field]);
        if (!Number.isInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative whole number`);
        if (field === 'level' && (value < 100 || value > 900 || value % 100 !== 0)) {
            throw new TypeError('level must be a hundred-level value between 100 and 900');
        }
        data[field] = value;
    }
    for (const [field, allowed] of [['offeredSemesters', COURSE_SEMESTERS], ['assessmentTypes', ASSESSMENT_TYPES]]) {
        if (body[field] === undefined) continue;
        if (!Array.isArray(body[field]) || body[field].some((value) => !allowed.has(value))) {
            throw new TypeError(`Invalid ${field}`);
        }
        data[field] = [...new Set(body[field])];
    }
    if (body.officialLink !== undefined) {
        const value = typeof body.officialLink === 'string' ? body.officialLink.trim() : '';
        if (!value) data.officialLink = null;
        else {
            let url;
            try { url = new URL(value); } catch { throw new TypeError('officialLink must be a valid URL'); }
            if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('officialLink must use HTTP or HTTPS');
            data.officialLink = url.toString();
        }
    }
    if (body.isActive !== undefined) {
        if (typeof body.isActive !== 'boolean') throw new TypeError('isActive must be true or false');
        data.isActive = body.isActive;
    }
    if (body.subjectId !== undefined) {
        if (body.subjectId === null || body.subjectId === '') {
            data.subjectId = null;
        } else {
            const subjectId = Number(body.subjectId);

            if (
                !Number.isSafeInteger(subjectId) ||
                subjectId <= 0
            ) {
                throw new TypeError(
                    'subjectId must be a positive integer'
                );
            }

            data.subjectId = subjectId;
        }
    }
    return data;
};

const getCourses = async (req, res) => {
    try {
        const skip = Number(req.query.skip ?? 0);
        const take = Number(req.query.take ?? 50);

        if (
            !Number.isSafeInteger(skip) ||
            skip < 0 ||
            !Number.isSafeInteger(take) ||
            take < 1 ||
            take > 100
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'skip must be a non-negative integer, and take must be an integer between 1 and 100'
            });
        }

        const courses = await courseService.getAllCourses({
            skip,
            take
        });

        return res.status(200).json({
            success: true,
            data: courses,
            pagination: {
                skip,
                take,
                returned: courses.length
            }
        });
    } catch (error) {
        console.error('Course list query failed:', error);

        return res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

const getAdminCourses = async (_req, res) => {
    try {
        const courses = await courseService.getAllCoursesForAdmin();
        return res.status(200).json({ success: true, data: courses });
    } catch (error) {
        console.error('Admin course list query failed:', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const createCourse = async (req, res) => {
    try {
        const { name, code, credits, description, workloadHours, offeredSemesters,
            level, assessmentTypes, officialLink, prerequisiteIds, subjectId } = req.body;

        if (!name || !code) {
            return res.status(400).json({ success: false, message: 'Course name and code are required' });
        }

        if (credits === undefined || credits === null || !Number.isInteger(Number(credits)) || Number(credits) <= 0) {
            return res.status(400).json({ success: false, message: 'Credits must be a positive whole number' });
        }

        if (prerequisiteIds !== undefined && (!Array.isArray(prerequisiteIds) || prerequisiteIds.some((id) => typeof id !== 'string' && !Number.isInteger(id)))) {
            return res.status(400).json({ success: false, message: 'Prerequisites must be entered as course IDs or course codes' });
        }

        const newCourse = await courseService.createCourse(
            normalizeCoursePayload({ name, code, credits, description, workloadHours, offeredSemesters,
                level, assessmentTypes, officialLink, subjectId }),
            prerequisiteIds
        );
        res.status(201).json({ success: true, data: newCourse });
    } catch (error) {
        console.error('Course creation failed:', error);

        if (error instanceof TypeError) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error?.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'A course with this code already exists' });
        }
        if (error?.code === 'P2025') {
            return res.status(400).json({ success: false, message: 'One or more prerequisite course IDs do not exist' });
        }
        if (error?.code === 'PREREQUISITE_NOT_FOUND') {
            return res.status(400).json({
                success: false,
                message: `Prerequisite courses not found: ${error.meta?.missing?.join(', ')}`
            });
        }
        res.status(500).json({ success: false, message: 'Server Error during course creation' });
    }
};

const getCourseById = async (req, res) => {
    try {
        const courseId = req.params.id;
        const course = await courseService.getCourseById(courseId);
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        res.status(200).json({ success: true, data: course });
    } catch (error) {
        console.error('Course lookup failed:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const getCourseByCode = async (req, res) => {
    try {
        const course = await courseService.getCourseByCode(req.params.code);
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        return res.status(200).json({ success: true, data: course });
    } catch (error) {
        if (error instanceof TypeError) {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error('Get Course By Code Error:', error);
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const compareCourses = async (req, res) => {
    try {
        const { courseIds } = req.body;
        if (!Array.isArray(courseIds) || courseIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Please provide an array of courseIds' });
        }
        const normalizedIds = courseIds.map(Number);
        if (normalizedIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
            return res.status(400).json({ success: false, message: 'courseIds must contain positive integers' });
        }

        const courses = await courseService.getCoursesByIds([...new Set(normalizedIds)]);
        res.status(200).json({ success: true, data: courses });
    } catch (error) {
        console.error('Course comparison query failed:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const searchCourses = async (req, res) => {
    try {
        const courses = await courseService.searchCourses(req.query);

        res.status(200).json({
            success: true,
            count: courses.length,
            data: courses
        });
    } catch (error) {
        if (error instanceof TypeError) {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error('Advanced search failed:', error);
        res.status(500).json({ success: false, message: 'Server Error during search' });
    }
};

const updateCourse = async (req, res) => {
    try {
        if (!/^\d+$/.test(req.params.id)) {
            return res.status(400).json({ success: false, message: 'A valid course id is required' });
        }
        const normalized = normalizeCoursePayload(req.body, { partial: true });
        if (req.body.prerequisiteIds !== undefined) normalized.prerequisiteIds = req.body.prerequisiteIds;
        const updatedCourse = await courseService.updateCourse(req.params.id, normalized);
        res.status(200).json({ success: true, data: updatedCourse });
    } catch (error) {
        if (error instanceof TypeError || error.code === 'PREREQUISITE_NOT_FOUND') {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'A course with this code already exists' });
        }
        if (error.code === 'P2025') {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        console.error('Course update failed:', error);
        res.status(500).json({ success: false, message: 'Server Error during course update' });
    }
};

module.exports = {
    getCourses,
    getAdminCourses,
    createCourse,
    updateCourse,
    getCourseById,
    getCourseByCode,
    compareCourses,
    searchCourses
};
