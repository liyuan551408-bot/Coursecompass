const test = require('node:test');
const assert = require('node:assert/strict');

const {
    enqueueCourseEmbedding,
    runCourseEmbeddingJob
} = require('../src/services/courseEmbeddingService');

test('enqueueCourseEmbedding schedules exactly one job without waiting for it', async () => {
    const course = { id: 42, code: 'TEST.101' };
    const scheduled = [];
    const processed = [];

    const result = enqueueCourseEmbedding(course, {
        schedule: (job) => scheduled.push(job),
        runJob: async (queuedCourse) => processed.push(queuedCourse.id)
    });

    assert.equal(result, undefined);
    assert.equal(scheduled.length, 1);
    assert.deepEqual(processed, []);

    await scheduled[0]();

    assert.deepEqual(processed, [course.id]);
});

test('runCourseEmbeddingJob contains failures so the API process stays healthy', async () => {
    const originalError = console.error;
    console.error = () => {};

    try {
        const succeeded = await runCourseEmbeddingJob(
            { id: 43, code: 'TEST.102' },
            async () => { throw new Error('provider unavailable'); }
        );

        assert.equal(succeeded, false);
    } finally {
        console.error = originalError;
    }
});
