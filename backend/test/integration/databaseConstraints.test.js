const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const prisma = require('../../src/lib/prisma');

const TEST_EMAIL = 'day5.constraints@coursecompass.test';

const COURSE_CODES = [
    'DAY5.TEST.COURSE',
    'DAY5.BAD.CREDITS',
    'DAY5.BAD.WORKLOAD'
];

const expectRejected = async (label, operation) => {
    let rejected = false;

    try {
        await operation();
    } catch (error) {
        rejected = true;
    }

    assert.equal(rejected, true, `${label} should have been rejected`);
    console.log(`Passed: ${label}`);
};

const cleanUp = async () => {

    await prisma.user.deleteMany({
        where: {
            email: TEST_EMAIL
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

    const testCourse = await prisma.course.create({
        data: {
            code: 'DAY5.TEST.COURSE',
            name: 'Day 5 Constraint Test Course',
            description: 'Temporary course used by the database test.',
            credits: 15,
            workloadHours: 150
        }
    });

    await expectRejected(
        'duplicate course code',
        () =>
            prisma.course.create({
                data: {
                    code: testCourse.code,
                    name: 'Duplicate Course',
                    credits: 15
                }
            })
    );

    await expectRejected(
        'course credits must be positive',
        () =>
            prisma.course.create({
                data: {
                    code: 'DAY5.BAD.CREDITS',
                    name: 'Invalid Credits Course',
                    credits: 0
                }
            })
    );

    await expectRejected(
        'course workload cannot be negative',
        () =>
            prisma.course.create({
                data: {
                    code: 'DAY5.BAD.WORKLOAD',
                    name: 'Invalid Workload Course',
                    credits: 15,
                    workloadHours: -1
                }
            })
    );

    const passwordHash = await bcrypt.hash('Day5Test123!', 10);

    const testUser = await prisma.user.create({
        data: {
            email: TEST_EMAIL,
            passwordHash,
            name: 'Day 5 Test User'
        }
    });

    await expectRejected(
        'review rating must be between 1 and 5',
        () =>
            prisma.review.create({
                data: {
                    userId: testUser.id,
                    courseId: testCourse.id,
                    overallRating: 6,
                    difficultyRating: 3,
                    workloadRating: 3
                }
            })
    );

    const semesterPlan = await prisma.semesterPlan.create({
        data: {
            userId: testUser.id,
            name: 'Constraint Test Plan',
            year: 2026,
            semester: 'Semester 2'
        }
    });

    await expectRejected(
        'duplicate semester plan',
        () =>
            prisma.semesterPlan.create({
                data: {
                    userId: testUser.id,
                    name: 'Constraint Test Plan',
                    year: 2026,
                    semester: 'Semester 2'
                }
            })
    );

    await prisma.savedCourse.create({
        data: {
            userId: testUser.id,
            courseId: testCourse.id
        }
    });

    await prisma.planCourse.create({
        data: {
            planId: semesterPlan.id,
            courseId: testCourse.id
        }
    });

    await prisma.user.delete({
        where: {
            id: testUser.id
        }
    });

    const savedCourseCount = await prisma.savedCourse.count({
        where: {
            userId: testUser.id
        }
    });

    const semesterPlanCount = await prisma.semesterPlan.count({
        where: {
            userId: testUser.id
        }
    });

    const planCourseCount = await prisma.planCourse.count({
        where: {
            planId: semesterPlan.id
        }
    });

    assert.equal(savedCourseCount, 0);
    assert.equal(semesterPlanCount, 0);
    assert.equal(planCourseCount, 0);

    console.log('Passed: user relationship cascade deletion');
    console.log('Database constraint smoke test passed.');
};

run()
    .catch((error) => {
        console.error('Database constraint smoke test failed.');
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await cleanUp();
        await prisma.$disconnect();
    });