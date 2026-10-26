/** @file Exercises extended database.smoke behavior as a repeatable command-line smoke check. */
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const prisma = require('../../src/lib/prisma');
const reviewService =
    require('../../src/services/reviewService');
const completedCourseService =
    require('../../src/services/completedCourseService');
const courseService =
    require('../../src/services/courseService');

const TEST_EMAIL =
    'extended.database@coursecompass.test';
const REPORTER_EMAIL =
    'extended.reporter@coursecompass.test';
const MODERATOR_EMAIL =
    'extended.moderator@coursecompass.test';

const COURSE_CODES = [
    'EXT.TEST.101',
    'EXT.TEST.201'
];

const cleanUp = async () => {
    await prisma.review.deleteMany({
        where: {
            course: {
                code: {
                    in: COURSE_CODES
                }
            }
        }
    });

    await prisma.completedCourse.deleteMany({
        where: {
            course: {
                code: {
                    in: COURSE_CODES
                }
            }
        }
    });

    await prisma.user.deleteMany({
        where: {
            email: { in: [TEST_EMAIL, REPORTER_EMAIL, MODERATOR_EMAIL] }
        }
    });

    await prisma.course.deleteMany({
        where: {
            code: {
                in: COURSE_CODES
            }
        }
    });
};

const run = async () => {
    await cleanUp();

    // Shared databases may already contain pending reviews and reports.
    // Verify this fixture's changes without assuming the moderation queue is empty.
    const initialQueue = await reviewService.getModerationQueueCounts();

    const passwordHash =
        await bcrypt.hash('ExtendedTest123!', 10);

    const user = await prisma.user.create({
        data: {
            email: TEST_EMAIL,
            passwordHash,
            name: 'Extended Database Test User',
            studyYear: 3,
            interests: ['Software Engineering'],
            goals: ['Complete database testing'],
            planningPreferences: {
                preferredWorkload: 'MEDIUM'
            }
        }
    });

    const reporter = await prisma.user.create({
        data: {
            email: REPORTER_EMAIL,
            passwordHash,
            name: 'Extended Database Reporter'
        }
    });

    const moderator = await prisma.user.create({
        data: {
            email: MODERATOR_EMAIL,
            passwordHash,
            name: 'Extended Database Moderator',
            role: 'MODERATOR'
        }
    });

    const firstCourse = await prisma.course.create({
        data: {
            code: COURSE_CODES[0],
            name: 'Extended Test Course 101',
            credits: 15,
            workloadHours: 120,
            offeredSemesters: ['SEMESTER_1'],
            level: 100,
            assessmentTypes: [
                'ASSIGNMENT',
                'PROJECT'
            ]
        }
    });

    const secondCourse = await prisma.course.create({
        data: {
            code: COURSE_CODES[1],
            name: 'Extended Test Course 201',
            credits: 15,
            workloadHours: 150,
            offeredSemesters: ['SEMESTER_2'],
            level: 200,
            assessmentTypes: [
                'EXAM',
                'ASSIGNMENT'
            ]
        }
    });

    const createdReview =
        await reviewService.createReview({
            userId: user.id,
            courseId: firstCourse.id,
            overallRating: 4,
            difficultyRating: 3,
            workloadRating: 4,
            teachingRating: 5,
            assessmentStyle: 'PROJECT_BASED',
            usefulnessRating: 5,
            comment: 'Extended database test review.'
        });

    assert.equal(createdReview.status, 'PENDING');
    assert.equal(createdReview.teachingRating, 5);
    assert.equal(
        createdReview.assessmentStyle,
        'PROJECT_BASED'
    );
    assert.equal(createdReview.usefulnessRating, 5);

    assert.deepEqual(
        await reviewService.getModerationQueueCounts(),
        {
            reviews: initialQueue.reviews + 1,
            reports: initialQueue.reports,
            total: initialQueue.total + 1
        }
    );

    console.log('Passed: create review');

    await reviewService.updateReviewStatus(
        createdReview.id,
        'APPROVED'
    );

    const approvalNotification =
        await prisma.notification.findFirst({
            where: {
                userId: user.id,
                type: 'REVIEW_APPROVED'
            },
            orderBy: { createdAt: 'desc' }
        });

    assert.ok(approvalNotification);
    assert.equal(
        approvalNotification.title,
        'Review approved'
    );
    assert.match(
        approvalNotification.message,
        /EXT\.TEST\.101.*approved.*published/
    );

    // Repeating the same decision must not create a duplicate notification.
    await reviewService.updateReviewStatus(
        createdReview.id,
        'APPROVED'
    );
    assert.equal(
        await prisma.notification.count({
            where: {
                userId: user.id,
                type: 'REVIEW_APPROVED'
            }
        }),
        1
    );

    console.log('Passed: approval notification');

    const report = await reviewService.reportReview(
        createdReview.id,
        reporter.id,
        'The comment should be checked.'
    );

    assert.ok(await prisma.notification.findFirst({
        where: { userId: reporter.id, type: 'REVIEW_REPORT_SUBMITTED' }
    }));
    assert.ok(await prisma.notification.findFirst({
        where: { userId: moderator.id, type: 'NEW_REVIEW_REPORT' }
    }));
    assert.deepEqual(
        await reviewService.getModerationQueueCounts(),
        {
            reviews: initialQueue.reviews,
            reports: initialQueue.reports + 1,
            total: initialQueue.total + 1
        }
    );

    await reviewService.updateReportStatus(report.id, 'RESOLVED');
    assert.ok(await prisma.notification.findFirst({
        where: { userId: reporter.id, type: 'REPORT_UPDATE' }
    }));
    assert.deepEqual(
        await reviewService.getModerationQueueCounts(),
        initialQueue
    );

    console.log('Passed: report notifications and moderation counts');

    const comparison = await courseService.getCoursesByIds([
        firstCourse.id,
        secondCourse.id
    ]);

    assert.equal(comparison.length, 2);

    const firstComparison = comparison.find(
        (course) => course.code === COURSE_CODES[0]
    );

    const secondComparison = comparison.find(
        (course) => course.code === COURSE_CODES[1]
    );

    assert.ok(firstComparison);
    assert.ok(secondComparison);

    const firstRating = await reviewService.getCourseRatingSummary(firstCourse.id);
    const secondRating = await reviewService.getCourseRatingSummary(secondCourse.id);
    assert.equal(firstRating.reviewCount, 1);
    assert.equal(firstRating.overallRating, 4);
    assert.equal(secondRating.reviewCount, 0);

    console.log('Passed: course comparison and rating summaries');

    const updatedReview =
        await reviewService.updateReview(
            user.id,
            firstCourse.id,
            {
                overallRating: 5,
                assessmentStyle: 'BALANCED',
                usefulnessRating: 4
            }
        );

    assert.equal(updatedReview.overallRating, 5);
    assert.equal(
        updatedReview.assessmentStyle,
        'BALANCED'
    );
    assert.equal(updatedReview.usefulnessRating, 4);
    assert.equal(updatedReview.status, 'PENDING');

    console.log('Passed: update review');

    const completionDate =
        '2026-06-30T00:00:00.000Z';

    await completedCourseService.markCourseCompleted(
        user.id,
        secondCourse.id,
        completionDate
    );

    // Run the operation twice to prove that upsert remains idempotent.
    await completedCourseService.markCourseCompleted(
        user.id,
        secondCourse.id,
        completionDate
    );

    const completedCourses =
        await completedCourseService
            .getCompletedCoursesByUser(user.id);

    assert.equal(completedCourses.length, 1);
    assert.equal(
        completedCourses[0].course.code,
        COURSE_CODES[1]
    );
    assert.equal(
        completedCourses[0].completedAt.toISOString(),
        completionDate
    );

    console.log('Passed: mark and query completed course');

    const removed =
        await completedCourseService
            .unmarkCourseCompleted(
                user.id,
                secondCourse.id
            );

    assert.equal(removed, true);

    const remainingCourses =
        await completedCourseService
            .getCompletedCoursesByUser(user.id);

    assert.equal(remainingCourses.length, 0);

    console.log('Passed: unmark completed course');
    console.log(
        'Extended database smoke test passed.'
    );
};

run()
    .catch((error) => {
        console.error(
            'Extended database smoke test failed.'
        );
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await cleanUp();
        await prisma.$disconnect();
    });
