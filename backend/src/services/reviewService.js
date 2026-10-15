const prisma = require('../lib/prisma');
const { createNotificationsSafely } = require('./notificationService');

const VALID_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED', 'HIDDEN']);

const reviewSelect = {
    id: true,
    userId: true,
    courseId: true,
    overallRating: true,
    difficultyRating: true,
    workloadRating: true,
    teachingRating: true,
    assessmentStyle: true,
    usefulnessRating: true,
    comment: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    user: {
        select: { id: true, name: true, major: true }
    },
    course: {
        select: { id: true, code: true, name: true }
    }
};

const reportSelect = {
    id: true,
    reviewId: true,
    reporterId: true,
    reason: true,
    status: true,
    createdAt: true,
    review: {
        select: {
            id: true,
            comment: true,
            status: true,
            course: { select: { id: true, code: true, name: true } }
        }
    },
    reporter: {
        select: { id: true, name: true }
    }
};

const validateRating = (fieldName, value, required = true) => {
    if (value === undefined || value === null) {
        if (required) { throw new TypeError(`${fieldName} is required`); }
        return;
    }
    if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw new TypeError(`${fieldName} must be an integer between 1 and 5`);
    }
};

const assessmentStyles = new Set([
    'EXAM_HEAVY', 'COURSEWORK_HEAVY', 'PROJECT_BASED', 'PRACTICAL', 'BALANCED'
]);

const validateAssessmentStyle = (value) => {
    if (value === undefined || value === null) return;
    if (!assessmentStyles.has(value)) {
        throw new TypeError('Invalid assessment style');
    }
};

const validatePositiveInteger = (fieldName, value) => {
    if (!Number.isInteger(value) || value <= 0) {
        throw new TypeError(`${fieldName} must be a positive integer`);
    }
};

const validateReviewData = (data, required) => {
    validateRating('overallRating', data.overallRating, required);
    validateRating('difficultyRating', data.difficultyRating, required);
    validateRating('workloadRating', data.workloadRating, required);
    validateRating('teachingRating', data.teachingRating, false);
    validateRating('usefulnessRating', data.usefulnessRating, false);
    validateAssessmentStyle(data.assessmentStyle);

    if (data.comment !== undefined && data.comment !== null && typeof data.comment !== 'string') {
        throw new TypeError('Comment must be a string');
    }
    if (typeof data.comment === 'string' && data.comment.length > 2000) {
        throw new TypeError('Comment must be at most 2000 characters');
    }
};

const ensureCourseExists = async (courseId) => {
    const course = await prisma.course.findFirst({
        where: { id: courseId, isActive: true }
    });
    if (!course) {
        const error = new Error('Course not found');
        error.statusCode = 404;
        throw error;
    }
    return course;
};

const createReview = async (data) => {
    validatePositiveInteger('userId', data.userId);
    validatePositiveInteger('courseId', data.courseId);
    validateReviewData(data, true);
    await ensureCourseExists(data.courseId);

    const created = await prisma.review.create({
        data: {
            userId: data.userId,
            courseId: data.courseId,
            overallRating: data.overallRating,
            difficultyRating: data.difficultyRating,
            workloadRating: data.workloadRating,
            teachingRating: data.teachingRating ?? null,
            assessmentStyle: data.assessmentStyle ?? null,
            usefulnessRating: data.usefulnessRating ?? null,
            comment: data.comment ?? null,
            status: 'PENDING'
        },
        select: reviewSelect
    });
    await createNotificationsSafely([data.userId], {
        type: 'REVIEW_SUBMITTED',
        title: 'Review submitted',
        message: 'Your review was submitted and is waiting for moderator approval.'
    });
    return created;
};

const updateReview = async (userId, courseId, data) => {
    validatePositiveInteger('userId', userId);
    validatePositiveInteger('courseId', courseId);
    validateReviewData(data, false);

    const existing = await prisma.review.findUnique({
        where: { userId_courseId: { userId, courseId } }
    });
    if (!existing) {
        const error = new Error('Review not found');
        error.statusCode = 404;
        throw error;
    }

    const updateData = {};
    const editableFields = [
        'overallRating', 'difficultyRating', 'workloadRating', 'teachingRating',
        'assessmentStyle', 'usefulnessRating', 'comment'
    ];

    for (const field of editableFields) {
        if (data[field] !== undefined) {
            updateData[field] = data[field];
        }
    }

    // Edited content must be moderated again, even if the original review was approved.
    updateData.status = 'PENDING';

    const updated = await prisma.review.update({
        where: { userId_courseId: { userId, courseId } },
        data: updateData,
        select: reviewSelect
    });
    await createNotificationsSafely([userId], {
        type: 'REVIEW_SUBMITTED',
        title: 'Review changes submitted',
        message: `Your updated review for ${updated.course?.code || 'a course'} is waiting for moderator approval.`
    });
    return updated;
};

const getApprovedReviewsByCourse = async (courseId) => {

    return prisma.review.findMany({
        where: {
            courseId: Number(courseId),
            status: 'APPROVED'
        },
        select: reviewSelect,
        orderBy: { createdAt: 'desc' }
    });
};

const getUserReviewForCourse = async (userId, courseId) => {
    validatePositiveInteger('userId', Number(userId));
    validatePositiveInteger('courseId', Number(courseId));
    return prisma.review.findUnique({
        where: { userId_courseId: { userId: Number(userId), courseId: Number(courseId) } },
        select: reviewSelect
    });
};

const getPendingReviews = async () => {
    return prisma.review.findMany({
        where: { status: 'PENDING' },
        select: reviewSelect,
        orderBy: { createdAt: 'asc' }
    });
};

const updateReviewStatus = async (reviewId, newStatus) => {
    if (!VALID_STATUSES.has(newStatus)) {
        throw new TypeError('Invalid review status');
    }

    const review = await prisma.review.findUnique({
        where: { id: Number(reviewId) }
    });
    if (!review) {
        const error = new Error('Review not found');
        error.statusCode = 404;
        throw error;
    }

    const updated = await prisma.review.update({
        where: { id: Number(reviewId) },
        data: { status: newStatus },
        select: reviewSelect
    });

    // Repeating an unchanged moderation decision should not send another notification.
    if (review.status !== newStatus) {
        const courseLabel = [updated.course?.code, updated.course?.name].filter(Boolean).join(' — ') || 'a course';
        const notification = newStatus === 'APPROVED'
            ? {
                type: 'REVIEW_APPROVED',
                title: 'Review approved',
                message: `Your review for ${courseLabel} has been approved and is now published.`
            }
            : {
                type: 'REVIEW_MODERATION',
                title: 'Review moderation update',
                message: `Your review for ${courseLabel} is now ${newStatus.toLowerCase()}.`
            };
        await createNotificationsSafely([review.userId], notification);
    }
    return updated;
};

const reportReview = async (reviewId, reporterId, reason) => {
    validatePositiveInteger('reviewId', reviewId);
    validatePositiveInteger('reporterId', reporterId);

    if (typeof reason !== 'string' || reason.trim() === '') {
        throw new TypeError('A report reason is required');
    }
    if (reason.trim().length > 1000) throw new TypeError('Report reason must be at most 1000 characters');

    const review = await prisma.review.findFirst({
        where: {
            id: reviewId,
            status: 'APPROVED',
            course: {
                isActive: true
            }
        },
        select: {
            id: true,
            userId: true
        }
    });
    if (!review) {
        const error = new Error('Review not found');
        error.statusCode = 404;
        throw error;
    }
    if (review.userId === reporterId) {
        throw new TypeError('You cannot report your own review');
    }

    const report = await prisma.reviewReport.create({
        data: {
            reviewId,
            reporterId,
            reason: reason.trim()
        },
        select: {
            id: true,
            reviewId: true,
            status: true,
            createdAt: true
        }
    });
    await createNotificationsSafely([reporterId], {
        type: 'REVIEW_REPORT_SUBMITTED',
        title: 'Report submitted',
        message: 'Your review report was submitted and is waiting for moderation.'
    });
    const moderators = await prisma.user.findMany({
        where: { role: 'MODERATOR' },
        select: { id: true }
    });
    await createNotificationsSafely(moderators.map(({ id }) => id), {
        type: 'NEW_REVIEW_REPORT',
        title: 'New review report',
        message: 'A student review has been reported and is waiting for moderation.'
    });
    return report;
};

const getPendingReports = async () => {
    return prisma.reviewReport.findMany({
        where: { status: 'PENDING' },
        select: reportSelect,
        orderBy: { createdAt: 'asc' }
    });
};

const getModerationQueueCounts = async () => {
    const [reviews, reports] = await Promise.all([
        prisma.review.count({ where: { status: 'PENDING' } }),
        prisma.reviewReport.count({ where: { status: 'PENDING' } })
    ]);
    return { reviews, reports, total: reviews + reports };
};

const updateReportStatus = async (reportId, newStatus) => {
    const validStatuses = new Set(['RESOLVED', 'DISMISSED']);
    if (!validStatuses.has(newStatus)) {
        throw new TypeError('Report status must be RESOLVED or DISMISSED');
    }
    const existing = await prisma.reviewReport.findUnique({ where: { id: Number(reportId) } });
    if (!existing) {
        const error = new Error('Report not found');
        error.statusCode = 404;
        throw error;
    }
    const updated = await prisma.reviewReport.update({
        where: { id: Number(reportId) },
        data: { status: newStatus },
        select: reportSelect
    });
    await createNotificationsSafely([existing.reporterId], {
        type: 'REPORT_UPDATE', title: 'Report update',
        message: `Your review report has been ${newStatus.toLowerCase()}.`
    });
    return updated;
};

const getCourseRatingSummary = async (courseId) => {
    const numericCourseId = Number(courseId);
    const groups = await prisma.review.groupBy({
        by: ['courseId'],
        where: {
            courseId: numericCourseId,
            status: 'APPROVED'
        },
        _avg: {
            overallRating: true,
            difficultyRating: true,
            workloadRating: true,
            teachingRating: true,
            usefulnessRating: true
        },
        _count: { _all: true }
    });

    if (groups.length === 0) {
        return {
            courseId: numericCourseId,
            reviewCount: 0,
            overallRating: null,
            difficultyRating: null,
            workloadRating: null,
            teachingRating: null,
            usefulnessRating: null
        };
    }

    const group = groups[0];
    return {
        courseId: numericCourseId,
        reviewCount: group._count._all,
        overallRating: group._avg.overallRating,
        difficultyRating: group._avg.difficultyRating,
        workloadRating: group._avg.workloadRating,
        teachingRating: group._avg.teachingRating,
        usefulnessRating: group._avg.usefulnessRating
    };
};

module.exports = {
    createReview,
    updateReview,
    getApprovedReviewsByCourse,
    getUserReviewForCourse,
    getPendingReviews,
    updateReviewStatus,
    reportReview,
    getPendingReports,
    getModerationQueueCounts,
    updateReportStatus,
    getCourseRatingSummary
};
