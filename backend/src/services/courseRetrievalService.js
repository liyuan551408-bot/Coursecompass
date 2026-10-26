/** @file Implements course retrieval business rules and persistence operations. */
const prisma = require('../lib/prisma');
const aiService = require('./aiService');

const DEFAULT_THRESHOLD = Number(process.env.AI_SIMILARITY_THRESHOLD) || 0.35;

// Raw PostgreSQL enum arrays can be returned as either JavaScript arrays or
// array-literal strings, depending on the database adapter. Keep the API shape
// stable so frontend consumers never iterate over a string character by character.
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

/** Semantic retrieval: query embedding -> course filters -> similarity ranking -> course results. */
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
    // =====================================================================
    // Convert the student's retrieval text into a query vector.
    // generateEmbedding uses the configured bge-m3 model and validates 1024 dimensions.
    // Format the vector for PostgreSQL and prepare parameter values separately from SQL.
    // =====================================================================
    const embedding = await aiService.generateEmbedding(query);
    const vectorString = `[${embedding.join(',')}]`;
    const filters = [];
    const values = [vectorString, threshold];
    // =====================================================================
    // Exclude courses this student has already completed.
    // NOT EXISTS keeps a course only when no matching completion record exists.
    // =====================================================================
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
    // =====================================================================
    // Apply structured requirements alongside semantic relevance.
    // Filter by semester, assessment type, credit range, workload range, and level.
    // Each supplied filter adds an SQL condition and its corresponding parameter.
    // =====================================================================
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
    // =====================================================================
    // Rank active courses by pgvector cosine distance.
    // <=> calculates distance; 1 - distance is the similarity score.
    // Require an embedding and minimum similarity, then apply the filters above.
    // ORDER BY returns the closest matches first; LIMIT controls result count.
    // Similarity measures semantic relevance, not recommendation accuracy.
    // =====================================================================
    values.push(limit);
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

    // =====================================================================
    // Add subject and prerequisite information to the retrieved courses.
    // Look up only the returned IDs, then index the details by course ID.
    // =====================================================================
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
    const detailsById = new Map(details.map(course => [course.id, course]));

    // =====================================================================
    // Return consistent course objects for explanations and display.
    // Preserve retrieval order, normalize enum arrays, and convert similarity to a number.
    // =====================================================================
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
