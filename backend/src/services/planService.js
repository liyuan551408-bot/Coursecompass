const prisma = require('../lib/prisma');
const { createNotificationsSafely, deleteExpired } = require('./notificationService');

const createPlan = async (userId, data) => {
    const plan = await prisma.semesterPlan.create({
        data: {
            userId: Number(userId),
            name: data.name.trim(),
            year: Number(data.year),
            semester: data.semester
        }
    });
    await createNotificationsSafely([userId], { type: 'PLAN_CREATED', title: 'Semester plan created', message: `Your ${plan.semester} ${plan.year} plan is ready.` });
    return plan;
};

const getUserPlans = async (userId) => {
    return prisma.semesterPlan.findMany({
        where: { userId: Number(userId) },
        include: {

            planCourses: {
                include: {
                    course: true
                }
            }
        },
        orderBy: [
            { year: 'desc' },
            { semester: 'desc' }
        ]
    });
};

// Check ownership in the service so knowing another student's plan ID grants no access.
const requireOwnedPlan = async (userId, planId) => {
    const plan = await prisma.semesterPlan.findUnique({ where: { id: Number(planId) } });
    if (!plan) {
        const error = new Error('Plan not found');
        error.statusCode = 404;
        throw error;
    }
    if (plan.userId !== Number(userId)) {
        const error = new Error('You do not have access to this plan');
        error.statusCode = 403;
        throw error;
    }
    return plan;
};

const addCourseToPlan = async (userId, planId, courseId, { confirmPrerequisites = true } = {}) => {
    const targetPlan = await requireOwnedPlan(userId, planId);

    const course = await prisma.course.findFirst({
        where: { id: Number(courseId), isActive: true },
        include: { prerequisites: true }
    });

    if (!course) {
        const error = new Error('Active course not found');
        error.statusCode = 404;
        throw error;
    }

    let warnings = [];

    if (course.prerequisites.length > 0) {

        const completed = await prisma.completedCourse.findMany({
            where: { userId: Number(userId) }
        });
        const completedIds = completed.map(c => c.courseId);

        const planned = await prisma.planCourse.findMany({
            where: { plan: { userId: Number(userId) } },
            include: { plan: { select: { year: true, semester: true } } }
        });
        const semesterOrder = { SUMMER: 0, SEMESTER_1: 1, SEMESTER_2: 2 };
        // Courses in the same or a later semester do not satisfy a planned prerequisite.
        const isEarlierPlan = (plan) => plan.year < targetPlan.year || (
            plan.year === targetPlan.year
            && (semesterOrder[plan.semester] ?? 99) < (semesterOrder[targetPlan.semester] ?? 99)
        );
        const plannedIds = planned.filter(({ plan }) => isEarlierPlan(plan)).map(({ courseId: id }) => id);

        const missingPrereqs = course.prerequisites.filter(p =>
            !completedIds.includes(p.id) && !plannedIds.includes(p.id)
        );

        if (missingPrereqs.length > 0) {
            const missingCodes = missingPrereqs.map(p => p.code).join(', ');
            warnings.push(`Warning: You may be missing prerequisites for this course: ${missingCodes}`);
        }
    }

    // Let the caller show warnings before committing when explicit confirmation is requested.
    if (warnings.length > 0 && !confirmPrerequisites) {
        return { course: null, warnings, requiresConfirmation: true };
    }

    const addedCourse = await prisma.planCourse.create({
        data: {
            planId: Number(planId),
            courseId: Number(courseId)
        },
        include: {
            course: true
        }
    });

    const result = {
        ...addedCourse,
        warnings,
        requiresConfirmation: false
    };
    await createNotificationsSafely([userId], { type: 'PLAN_COURSE_ADDED', title: 'Course added to planner', message: `${course.code} was added to your ${planId} semester plan.` });
    return result;
};

const removeCourseFromPlan = async (userId, planId, courseId) => {
    await requireOwnedPlan(userId, planId);
    const removed = await prisma.planCourse.delete({
        where: {
            planId_courseId: {
                planId: Number(planId),
                courseId: Number(courseId)
            }
        }
    });
    await createNotificationsSafely([userId], { type: 'PLAN_COURSE_REMOVED', title: 'Course removed from planner', message: `A course was removed from your semester plan.` });
    return removed;
};

const deletePlan = async (userId, planId) => {
    await requireOwnedPlan(userId, planId);
    return prisma.semesterPlan.delete({ where: { id: Number(planId) } });
};

module.exports = {
    createPlan,
    getUserPlans,
    addCourseToPlan,
    removeCourseFromPlan,
    deletePlan
};

setInterval(() => deleteExpired().catch((error) => console.error('Notification cleanup failed:', error)), 24 * 60 * 60 * 1000).unref();
