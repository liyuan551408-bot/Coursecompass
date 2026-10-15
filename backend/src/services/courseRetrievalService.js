const prisma = require('../lib/prisma');
const aiService = require('./aiService');

const DEFAULT_THRESHOLD = Number(process.env.AI_SIMILARITY_THRESHOLD) || 0.35;

// Raw queries may return enum arrays as PostgreSQL literals instead of JS arrays.
const normalizeEnumArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];

    const arrayLiteral = value.trim();
    if (!arrayLiteral || arrayLiteral === '{}') return [];

    const content = arrayLiteral.startsWith('{') && arrayLiteral.endsWith('}')
        ? arrayLiteral.slice(1, -1)
        : arrayLiteral;

    return content
        .split(',')
        .map(item => item.trim().replace(/^"|"$/g, ''))
        .filter(Boolean);
};

const semanticSearchCourses = async ({
    query,
    limit = 5,
    threshold = DEFAULT_THRESHOLD,
    semester,
    assessmentType,
    minCredits,
    maxCredits,
    minWorkload,
    maxWorkload,
    level,
    excludeUserId
}) => {

    const embedding = await aiService.generateEmbedding(query);
    const vectorString = `[${embedding.join(',')}]`;
    // Build only trusted SQL fragments; bind all request values through placeholders.
    const filters = [];
    const values = [vectorString, threshold];

    // Exclude completed courses before ranking and LIMIT so they do not consume result slots.
    if (excludeUserId !== undefined) {
    const userId = Number(excludeUserId);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
        throw new TypeError('Invalid user ID');
    }

    values.push(userId);

    filters.push(`
        AND NOT EXISTS (
            SELECT 1
            FROM "CompletedCourse" AS completed
            WHERE completed."courseId" = "Course"."id"
            AND completed."userId" = $${values.length}::int
        )
    `);
}

    if (semester) {
        values.push(semester);
        filters.push(`AND "offeredSemesters" @> ARRAY[$${values.length}]::"CourseSemester"[]`);
    }
    if (assessmentType) {
        values.push(assessmentType);
        filters.push(`AND "assessmentTypes" @> ARRAY[$${values.length}]::"AssessmentType"[]`);
    }
    if (minCredits !== undefined) {
        values.push(minCredits);
        filters.push(`AND credits >= $${values.length}::int`);
    }
    if (maxCredits !== undefined) {
        values.push(maxCredits);
        filters.push(`AND credits <= $${values.length}::int`);
    }
    if (minWorkload !== undefined) {
        values.push(minWorkload);
        filters.push(`AND "workloadHours" >= $${values.length}::int`);
    }
    if (maxWorkload !== undefined) {
        values.push(maxWorkload);
        filters.push(`AND "workloadHours" <= $${values.length}::int`);
    }
    if (level !== undefined) {
        values.push(level);
        filters.push(`AND level = $${values.length}::int`);
    }

    values.push(limit);
    // pgvector <=> is cosine distance: lower distances rank first; 1 - distance is similarity.
    const courses = await prisma.$queryRawUnsafe(`
        SELECT id, code, name, description, credits, level, "subjectId",
               "offeredSemesters", "assessmentTypes", "workloadHours", "officialLink",
               CAST(1 - (embedding <=> $1::vector) AS TEXT) AS similarity_text
        FROM "Course"
        WHERE embedding IS NOT NULL
          AND "isActive" = true
          AND 1 - (embedding <=> $1::vector) >= $2::float
          ${filters.join('\n          ')}
        ORDER BY embedding <=> $1::vector
        LIMIT $${values.length}::int;
    `, ...values);

    const details = courses.length
        ? await prisma.course.findMany({
            where: { id: { in: courses.map(course => course.id) } },
            select: {
                id: true,
                subject: { select: { id: true, code: true, name: true } },
                prerequisites: { select: { id: true, code: true, name: true } }
            }
        })
        : [];
    // Enrich results by ID while preserving the similarity order from the raw query.
    const detailsById = new Map(details.map(course => [course.id, course]));

    return courses.map(course => ({
        id: course.id,
        code: course.code,
        name: course.name,
        description: course.description,
        credits: course.credits,
        level: course.level,
        subjectId: course.subjectId,
        subject: detailsById.get(course.id)?.subject || null,
        prerequisites: detailsById.get(course.id)?.prerequisites || [],
        offeredSemesters: normalizeEnumArray(course.offeredSemesters),
        assessmentTypes: normalizeEnumArray(course.assessmentTypes),
        workloadHours: course.workloadHours,
        officialLink: course.officialLink,
        similarity: Number(course.similarity_text) || 0
    }));
};

module.exports = { semanticSearchCourses };
