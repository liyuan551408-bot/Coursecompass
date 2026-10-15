const reviewService = require('../services/reviewService');

const handleReviewError = (res, error, context) => {
    if (error instanceof TypeError) {
        return res.status(400).json({ success: false, message: error.message });
    }
    if (error.statusCode === 404) {
        return res.status(404).json({ success: false, message: error.message });
    }
    if (error.code === 'P2002') {
        return res.status(409).json({ success: false, message: context.duplicateMessage });
    }
    console.error(`${context.label} Error:`, error);
    return res.status(500).json({ success: false, message: 'Server Error' });
};

const parseReviewBody = (body) => ({
    overallRating: body.overallRating !== undefined ? Number(body.overallRating) : undefined,
    difficultyRating: body.difficultyRating !== undefined ? Number(body.difficultyRating) : undefined,
    workloadRating: body.workloadRating !== undefined ? Number(body.workloadRating) : undefined,
    teachingRating: body.teachingRating == null ? body.teachingRating : Number(body.teachingRating),
    usefulnessRating: body.usefulnessRating == null ? body.usefulnessRating : Number(body.usefulnessRating),
    assessmentStyle: body.assessmentStyle,
    comment: body.comment
});

const addReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = Number(req.body.courseId);
        const reviewData = parseReviewBody(req.body);

        if (!courseId || Number.isNaN(courseId)) {
            return res.status(400).json({ success: false, message: 'A valid courseId is required' });
        }
        if (
            reviewData.overallRating === undefined ||
            reviewData.difficultyRating === undefined ||
            reviewData.workloadRating === undefined
        ) {
            return res.status(400).json({ success: false, message: 'Missing required rating fields' });
        }

        const review = await reviewService.createReview({
            userId,
            courseId,
            ...reviewData
        });

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully and is pending approval',
            data: review
        });
    } catch (error) {
        return handleReviewError(res, error, {
            label: 'Add Review',
            duplicateMessage: 'You have already reviewed this course'
        });
    }
};

const updateReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = Number(req.params.courseId);
        const reviewData = parseReviewBody(req.body);

        if (!courseId || Number.isNaN(courseId)) {
            return res.status(400).json({ success: false, message: 'A valid courseId is required' });
        }

        const review = await reviewService.updateReview(userId, courseId, reviewData);

        res.status(200).json({
            success: true,
            message: 'Review updated successfully and is pending approval',
            data: review
        });
    } catch (error) {
        return handleReviewError(res, error, {
            label: 'Update Review',
            duplicateMessage: 'Review update conflict'
        });
    }
};

const getCourseReviews = async (req, res) => {
    try {
        const courseId = req.params.courseId;
        const reviews = await reviewService.getApprovedReviewsByCourse(courseId);

        res.status(200).json({ success: true, data: reviews });
    } catch (error) {
        return handleReviewError(res, error, { label: 'Get Reviews', duplicateMessage: '' });
    }
};

const getMyCourseReview = async (req, res) => {
    try {
        const review = await reviewService.getUserReviewForCourse(req.user.id, req.params.courseId);
        return res.status(200).json({ success: true, data: review });
    } catch (error) {
        return handleReviewError(res, error, { label: 'Get Own Review', duplicateMessage: '' });
    }
};

const getCourseRatingSummary = async (req, res) => {
    try {
        const summary = await reviewService.getCourseRatingSummary(req.params.courseId);
        res.status(200).json({ success: true, data: summary });
    } catch (error) {
        return handleReviewError(res, error, { label: 'Get Rating Summary', duplicateMessage: '' });
    }
};

const getPendingReviews = async (req, res) => {
    try {
        const reviews = await reviewService.getPendingReviews();
        res.status(200).json({ success: true, data: reviews });
    } catch (error) {
        return handleReviewError(res, error, { label: 'Get Pending Reviews', duplicateMessage: '' });
    }
};

const moderateReview = async (req, res) => {
    try {
        const reviewId = req.params.id;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'status is required' });
        }

        const updatedReview = await reviewService.updateReviewStatus(reviewId, status);

        res.status(200).json({
            success: true,
            message: `Review status updated to ${status}`,
            data: updatedReview
        });
    } catch (error) {
        return handleReviewError(res, error, { label: 'Moderate Review', duplicateMessage: '' });
    }
};

const reportReview = async (req, res) => {
    try {
        const reviewId = Number(req.params.id);
        const reporterId = req.user.id;
        const { reason } = req.body;

        if (!reviewId || Number.isNaN(reviewId)) {
            return res.status(400).json({ success: false, message: 'A valid review id is required' });
        }

        const report = await reviewService.reportReview(reviewId, reporterId, reason);

        res.status(201).json({
            success: true,
            message: 'Review reported successfully',
            data: report
        });
    } catch (error) {
        return handleReviewError(res, error, {
            label: 'Report Review',
            duplicateMessage: 'You have already reported this review'
        });
    }
};

const getPendingReports = async (req, res) => {
    try {
        const reports = await reviewService.getPendingReports();
        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        return handleReviewError(res, error, { label: 'Get Pending Reports', duplicateMessage: '' });
    }
};

const getModerationQueueCounts = async (req, res) => {
    try {
        const counts = await reviewService.getModerationQueueCounts();
        return res.status(200).json({ success: true, data: counts });
    } catch (error) {
        return handleReviewError(res, error, { label: 'Get Moderation Queue Counts', duplicateMessage: '' });
    }
};

const updateReportStatus = async (req, res) => {
    try {
        const report = await reviewService.updateReportStatus(req.params.id, req.body.status);
        return res.status(200).json({ success: true, data: report });
    } catch (error) {
        return handleReviewError(res, error, { label: 'Update Report', duplicateMessage: '' });
    }
};

module.exports = {
    addReview,
    updateReview,
    getCourseReviews,
    getMyCourseReview,
    getCourseRatingSummary,
    getPendingReviews,
    moderateReview,
    reportReview,
    getPendingReports,
    getModerationQueueCounts,
    updateReportStatus
};
