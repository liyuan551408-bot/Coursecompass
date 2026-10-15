const assert = require('node:assert/strict');

const prisma = require('../../src/lib/prisma');
const courseService = require('../../src/services/courseService');

const run = async () => {
    const databaseCount = await prisma.course.count({
        where: {
            isActive: true
        }
    });

    const courses = await courseService.getAllCourses();

    assert.ok(Array.isArray(courses));
    assert.equal(courses.length, Math.min(databaseCount, 50));

    for (const course of courses) {
        assert.equal(course.isActive, true);
        assert.equal(typeof course.name, 'string');
        assert.equal(typeof course.code, 'string');
        assert.equal('title' in course, false);
    }

    for (let index = 1; index < courses.length; index += 1) {
        assert.ok(
            courses[index - 1].code.localeCompare(courses[index].code) <= 0
        );
    }

    const limitedCourses = await courseService.getAllCourses({
        take: 1
    });

    assert.ok(limitedCourses.length <= 1);

    console.log(
        `Course Service smoke test passed. Active courses: ${databaseCount}`
    );
};

run()
    .catch((error) => {
        console.error('Course Service smoke test failed.');
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });