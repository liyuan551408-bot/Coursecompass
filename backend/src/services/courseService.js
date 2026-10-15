const prisma = require('../lib/prisma');
const {
    refreshCourseEmbedding,
    enqueueCourseEmbedding
} = require('./courseEmbeddingService');
const { rankFuzzyCourses } = require('../utils/fuzzySearch');
const { createNotificationsSafely } = require('./notificationService');
const { resolvePrerequisiteCourses } = require('./prerequisiteService');

const courseSelect = {
    id: true,
    code: true,
    name: true,
    description: true,
    credits: true,
    workloadHours: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    offeredSemesters: true,
    level: true,
    assessmentTypes: true,
    officialLink: true,
    subjectId: true,
    subject: {
        select: {
            id: true,
            code: true,
            name: true
        }
    },
    prerequisites: {
        select: {
            id:true,
            code:true,
            name:true
        },
        orderBy: {
            code: 'asc'
        }
    },
};

const courseDetailSelect = {
    ...courseSelect,
    reviews: {
        where: {
            status: 'APPROVED'
        },
        select: {
            id:true,
            overallRating:true,
            difficultyRating:true,
            workloadRating:true,
            teachingRating:true,
            assessmentStyle:true,
            usefulnessRating:true,
            comment:true,
            createdAt:true,
            user: {
                select: {
                    id:true,
                    name:true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
    }
};

const getAllCourses = async ({ skip = 0, take = 50 } = {}) => {
    const safeSkip = Number.isInteger(skip) && skip >= 0 ? skip : 0;
    const safeTake = Number.isInteger(take) && take > 0 ? Math.min(take, 100) : 50;

    return prisma.course.findMany({
        where: { isActive: true },
        select: courseSelect,
        orderBy: { code: 'asc'},
        skip: safeSkip,
        take: safeTake
    });
};

const getAllCoursesForAdmin = async () => prisma.course.findMany({
    select: courseSelect,
    orderBy: { code: 'asc' }
});

const createCourse = async (courseData, prerequisiteIds = []) => {
    const data = {
        name: courseData.name,
        code: courseData.code,
        credits: courseData.credits,
        description: courseData.description,
        workloadHours: courseData.workloadHours,
        offeredSemesters: courseData.offeredSemesters,
        level: courseData.level,
        assessmentTypes: courseData.assessmentTypes,
        officialLink: courseData.officialLink,
    };

    if (courseData.subjectId !== null &&
        courseData.subjectId !== undefined) {
        const subject = await prisma.subject.findUnique({
            where: { id: courseData.subjectId },
            select: { id: true }
        });

        if (!subject) {
            throw new TypeError('Subject not found');
        }

        data.subject = {
            connect: { id: subject.id }
        };
    }

    if (prerequisiteIds && prerequisiteIds.length > 0) {
        const prerequisiteCourses = await resolvePrerequisiteCourses(prisma, prerequisiteIds);
        data.prerequisites = {
            connect: prerequisiteCourses.map((course) => ({ id: course.id }))
        };
    }

    const createdCourse = await prisma.course.create({
        data,

        include: {
            prerequisites: true,
            subject: true
        }
    });

    enqueueCourseEmbedding(createdCourse);

    return createdCourse;
};

const updateCourse = async (id, courseData) => {
    const allowedFields = [
        'name', 'code', 'credits', 'description', 'workloadHours',
        'offeredSemesters', 'level', 'assessmentTypes', 'officialLink', 'isActive'
    ];
    const data = Object.fromEntries(
        allowedFields
            .filter((field) => courseData[field] !== undefined)
            .map((field) => [field, courseData[field]])
    );

    if (courseData.subjectId !== undefined) {
        if (courseData.subjectId === null) {
            data.subject = { disconnect: true };
        } else {
            const subject = await prisma.subject.findUnique({
                where: { id: courseData.subjectId },
                select: { id: true }
            });

            if (!subject) {
                throw new TypeError('Subject not found');
            }

            data.subject = {
                connect: { id: subject.id }
            };
        }
    }

    if (courseData.prerequisiteIds !== undefined) {
        const prerequisiteCourses = await resolvePrerequisiteCourses(prisma, courseData.prerequisiteIds);
        if (prerequisiteCourses.some((course) => course.id === Number(id))) {
            throw new TypeError('A course cannot be its own prerequisite');
        }
        data.prerequisites = { set: prerequisiteCourses.map((course) => ({ id: course.id })) };
    }

    const updatedCourse = await prisma.course.update({
        where: { id: Number(id) },
        data,
        include: {
            prerequisites: true,
            subject: true
        }
    });

    try {
        await refreshCourseEmbedding(updatedCourse);
    } catch (error) {
        console.error(`Course embedding generation failed for ${updatedCourse.code}:`, error);
    }

    const savedUsers = await prisma.savedCourse.findMany({ where: { courseId: updatedCourse.id }, select: { userId: true } });
    await createNotificationsSafely(savedUsers.map(({ userId }) => userId), {
        type: 'SAVED_COURSE_UPDATE',
        title: `${updatedCourse.code} was updated`,
        message: 'A course in your saved list has new information. Open the course page to review the changes.'
    });

    return updatedCourse;
};

const getCourseById = async (id) => {
    return prisma.course.findUnique({
        where: { id: Number(id), isActive: true },
        include: {
            prerequisites: true,
            prerequisiteFor: true,
            subject: true
        }
    });
};

const getCoursesByIds = async (courseIds) => {
    return prisma.course.findMany({
        where: {

            id: {
                in: courseIds.map(id => Number(id))
            },
            isActive: true
        },
        include: {
            prerequisites: true,
            subject: true
        }
    });
};

const getCoursesForComparisonAnalysis = async (courseIds) => {
    const normalizedIds = [...new Set(courseIds.map(id => Number(id)))];
    const courses = await prisma.course.findMany({
        where: {
            id: { in: normalizedIds },
            isActive: true
        },
        select: {
            id: true,
            code: true,
            name: true,
            description: true,
            credits: true,
            workloadHours: true,
            level: true,
            offeredSemesters: true,
            assessmentTypes: true,
            prerequisites: {
                select: { id: true, code: true, name: true },
                orderBy: { code: 'asc' }
            },
            prerequisiteFor: {
                select: { id: true, code: true, name: true },
                orderBy: { code: 'asc' }
            },
            reviews: {
                where: { status: 'APPROVED' },
                select: {
                    overallRating: true,
                    difficultyRating: true,
                    workloadRating: true,
                    teachingRating: true,
                    usefulnessRating: true,
                    assessmentStyle: true,
                    comment: true
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            }
        }
    });

    return courses.map(course => {
        const reviews = course.reviews;
        const average = field => {
            const values = reviews
                .map(review => review[field])
                .filter(value => value !== null && value !== undefined);
            return values.length
                ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
                : null;
        };

        return {
            id: course.id,
            code: course.code,
            name: course.name,

            description: course.description ? course.description.slice(0, 2000) : null,
            credits: course.credits,
            workloadHours: course.workloadHours,
            level: course.level,
            offeredSemesters: course.offeredSemesters,
            assessmentTypes: course.assessmentTypes,
            prerequisites: course.prerequisites,
            prerequisiteFor: course.prerequisiteFor,
            reviewSummary: {
                reviewCount: reviews.length,
                overallRating: average('overallRating'),
                difficultyRating: average('difficultyRating'),
                workloadRating: average('workloadRating'),
                teachingRating: average('teachingRating'),
                usefulnessRating: average('usefulnessRating'),
                assessmentStyles: [...new Set(reviews.map(review => review.assessmentStyle).filter(Boolean))],
                comments: reviews
                    .map(review => review.comment)
                    .filter(Boolean)
                    .slice(0, 5)
                    .map(comment => comment.slice(0, 500))
            }
        };
    });
};

const getCourseByCode = async (code) => {
    if (typeof code !== 'string' || code.trim() === '') {
        throw new TypeError('A valid course code is required');
    }

    const normalizedCode = code.trim().toUpperCase();

    return prisma.course.findUnique({
        where: {
            code: normalizedCode,
            isActive: true
        },
        select: courseDetailSelect
    });
};

const searchCourses = async (queryFilters) => {
    const { keyword, subject, subjectId, mode = 'keyword', level, semester, assessmentType, minCredits, maxCredits,
        minWorkload, maxWorkload, minRating, hasPrerequisites } = queryFilters;
    const whereClause = { isActive: true };
    if (subjectId !== undefined && subjectId !== '') {
        const parsedSubjectId = Number(subjectId);

        if (
            !Number.isSafeInteger(parsedSubjectId) ||
            parsedSubjectId <= 0
        ) {
            throw new TypeError(
                'subjectId must be a positive integer'
            );
        }

        whereClause.subjectId = parsedSubjectId;
    }
    const numericFilters = {};
    for (const [field, value] of Object.entries({ level, minCredits, maxCredits, minWorkload, maxWorkload, minRating })) {
        if (value !== undefined && value !== '') {
            const parsed = Number(value);
            if (!Number.isInteger(parsed) || parsed < 0) throw new TypeError(`${field} must be a non-negative whole number`);
            numericFilters[field] = parsed;
        }
    }
    if (numericFilters.minCredits !== undefined && numericFilters.maxCredits !== undefined
        && numericFilters.minCredits > numericFilters.maxCredits) {
        throw new TypeError('minCredits cannot exceed maxCredits');
    }
    if (numericFilters.minWorkload !== undefined && numericFilters.maxWorkload !== undefined
        && numericFilters.minWorkload > numericFilters.maxWorkload) {
        throw new TypeError('minWorkload cannot exceed maxWorkload');
    }
    if (semester && !['SEMESTER_1', 'SEMESTER_2', 'SUMMER'].includes(semester)) {
        throw new TypeError('Invalid semester filter');
    }
    if (assessmentType && !['EXAM', 'ASSIGNMENT', 'QUIZ', 'PROJECT', 'LAB', 'PRESENTATION'].includes(assessmentType)) {
        throw new TypeError('Invalid assessment type filter');
    }
    if (hasPrerequisites !== undefined && hasPrerequisites !== '' && !['true', 'false'].includes(String(hasPrerequisites))) {
        throw new TypeError('hasPrerequisites must be true or false');
    }
    if (numericFilters.minRating !== undefined && (numericFilters.minRating < 1 || numericFilters.minRating > 5)) {
        throw new TypeError('minRating must be between 1 and 5');
    }
    if (!['keyword', 'fuzzy'].includes(mode)) {
        throw new TypeError('Invalid search mode');
    }

    if (keyword && mode === 'keyword') {
        whereClause.OR = [
            { code: { contains: keyword, mode: 'insensitive' } },
            { name: { contains: keyword, mode: 'insensitive' } },
            { description: { contains: keyword, mode: 'insensitive' } }
        ];
    }
    if (subject) {
        if (typeof subject !== 'string' || subject.trim().length > 100) throw new TypeError('Invalid subject filter');
        const value = subject.trim();
        whereClause.AND = [{ OR: [
            { code: { startsWith: value, mode: 'insensitive' } },
            { name: { contains: value, mode: 'insensitive' } },
                { description: { contains: value, mode: 'insensitive' } }
        ] }];
    }

    if (numericFilters.level !== undefined) {
        whereClause.level = numericFilters.level;
    }

    if (semester) {
        whereClause.offeredSemesters = { has: semester };
    }

    if (assessmentType) {
        whereClause.assessmentTypes = { has: assessmentType };
    }

    if (numericFilters.minCredits !== undefined || numericFilters.maxCredits !== undefined) {
        whereClause.credits = {};
        if (numericFilters.minCredits !== undefined) whereClause.credits.gte = numericFilters.minCredits;
        if (numericFilters.maxCredits !== undefined) whereClause.credits.lte = numericFilters.maxCredits;
    }
    if (numericFilters.minWorkload !== undefined || numericFilters.maxWorkload !== undefined) {
        whereClause.workloadHours = {};
        if (numericFilters.minWorkload !== undefined) whereClause.workloadHours.gte = numericFilters.minWorkload;
        if (numericFilters.maxWorkload !== undefined) whereClause.workloadHours.lte = numericFilters.maxWorkload;
    }

    if (hasPrerequisites !== undefined && hasPrerequisites !== '') {
        whereClause.prerequisites = String(hasPrerequisites) === 'true' ? { some: {} } : { none: {} };
    }

    const courses = await prisma.course.findMany({
        where: whereClause,
        select: {
            ...courseSelect,
            ...(numericFilters.minRating !== undefined ? {
                reviews: { where: { status: 'APPROVED' }, select: { overallRating: true } }
            } : {})
        },
        orderBy: { code: 'asc' }
    });

    const filteredCourses = courses.flatMap((course) => {
        const reviews = course.reviews;
        if (numericFilters.minRating !== undefined) {
            if (!reviews.length) return [];
            const average = reviews.reduce((sum, review) => sum + review.overallRating, 0) / reviews.length;
            if (average < numericFilters.minRating) return [];
        }
        const { reviews: _reviews, ...publicCourse } = course;
        return [publicCourse];
    });

    return keyword && mode === 'fuzzy' ? rankFuzzyCourses(filteredCourses, keyword) : filteredCourses;
};

module.exports = {
    getAllCourses,
    getAllCoursesForAdmin,
    createCourse,
    updateCourse,
    getCourseById,
    getCoursesByIds,
    getCoursesForComparisonAnalysis,
    getCourseByCode,
    searchCourses
};
