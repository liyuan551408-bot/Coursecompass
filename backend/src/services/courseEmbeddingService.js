const prisma = require('../lib/prisma');
const aiService = require('./aiService');

const formatList = (value) => {
    if (!Array.isArray(value) || value.length === 0) {
        return 'Not specified';
    }
    return value.join(', ');
};

// Use one text format for both batch generation and course-update embedding jobs.
const buildCourseEmbeddingText = (course) => {
    const description = course.description || 'No detailed description available.';

    return [
        `Course code: ${course.code}`,
        `Course name: ${course.name}`,
        `Course description: ${description}`,
        `Course level: ${course.level ?? 'Not specified'}`,
        `Course credits: ${course.credits ?? 'Not specified'}`,
        `Offered semesters: ${formatList(course.offeredSemesters)}`,
        `Assessment types: ${formatList(course.assessmentTypes)}`,
        `Workload hours: ${course.workloadHours ?? 'Not specified'}`
    ].join('. ');
};

const refreshCourseEmbedding = async (course) => {
    const embedding = await aiService.generateEmbedding(buildCourseEmbeddingText(course));
    const vectorString = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
        `UPDATE "Course" SET embedding = $1::vector WHERE id = $2`,
        vectorString,
        course.id
    );
};

const runCourseEmbeddingJob = async (course, refresh = refreshCourseEmbedding) => {
    try {
        await refresh(course);
        console.log(`[Embedding job] Stored vector for ${course.code}`);
        return true;
    } catch (error) {
        console.error(`[Embedding job] Failed for ${course.code}:`, error.message);
        return false;
    }
};

const enqueueCourseEmbedding = (
    course,
    { schedule = setImmediate, runJob = runCourseEmbeddingJob } = {}
) => {
    // Course writes complete independently of the provider; this in-memory job is not durable.
    schedule(() => Promise.resolve(runJob(course)).catch((error) => {
        console.error(`[Embedding job] Unexpected failure for ${course.code}:`, error.message);
    }));
};

module.exports = {
    refreshCourseEmbedding,
    runCourseEmbeddingJob,
    enqueueCourseEmbedding
};
