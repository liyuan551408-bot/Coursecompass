const { toPlainText } = require('../utils/plainText');

const RELATIONSHIP_TYPES = new Set([
    'prerequisite', 'complementary', 'workload', 'assessment', 'overlap', 'other'
]);

class InvalidAiComparisonError extends Error {
    constructor(message = 'The AI returned an invalid course comparison') {
        super(message);
        this.name = 'InvalidAiComparisonError';
        this.code = 'AI_COMPARE_INVALID_RESPONSE';
    }
}

// Track quoted strings and escapes so braces inside explanation text do not split JSON.
const findJsonObjects = (value) => {
    const objects = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (inString) {
            if (escaped) escaped = false;
            else if (character === '\\') escaped = true;
            else if (character === '"') inString = false;
            continue;
        }
        if (character === '"') {
            inString = true;
        } else if (character === '{') {
            if (depth === 0) start = index;
            depth += 1;
        } else if (character === '}' && depth > 0) {
            depth -= 1;
            if (depth === 0 && start >= 0) objects.push(value.slice(start, index + 1));
        }
    }
    return objects;
};

const parseAiJsonResponse = (raw) => {
    if (typeof raw !== 'string' || !raw.trim()) {
        throw new InvalidAiComparisonError('AI comparison output was empty');
    }
    const trimmed = raw.trim();
    const unfenced = trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    const candidates = [...new Set([unfenced, ...findJsonObjects(unfenced)])];

    for (const candidate of candidates) {
        try {
            let parsed = JSON.parse(candidate);
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        } catch {

        }
    }
    throw new InvalidAiComparisonError('AI comparison output was not valid JSON');
};

const cleanRequiredText = (value, field, maxLength) => {
    const cleaned = toPlainText(value).trim().slice(0, maxLength);
    if (!cleaned) throw new InvalidAiComparisonError(`${field} is required`);
    return cleaned;
};

const cleanOptionalText = (value, maxLength) => toPlainText(value).trim().slice(0, maxLength);

const validateCompareResponse = (value, courses) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new InvalidAiComparisonError('Comparison must be a JSON object');
    }
    const selectedIds = courses.map(course => Number(course.id));
    const selectedIdSet = new Set(selectedIds);
    if (!Array.isArray(value.relationships)) {
        throw new InvalidAiComparisonError('relationships must be an array');
    }
    if (!Array.isArray(value.learningOrder)) {
        throw new InvalidAiComparisonError('learningOrder must be an array');
    }

    const relationships = value.relationships.slice(0, 20).map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new InvalidAiComparisonError(`relationships[${index}] must be an object`);
        }
        const type = String(item.type || '').trim().toLowerCase();
        if (!RELATIONSHIP_TYPES.has(type)) {
            throw new InvalidAiComparisonError(`relationships[${index}].type is invalid`);
        }
        if (!Array.isArray(item.courseIds)) {
            throw new InvalidAiComparisonError(`relationships[${index}].courseIds must be an array`);
        }
        const courseIds = [...new Set(item.courseIds.map(Number))];
        if (courseIds.length < 2 || courseIds.some(id => !selectedIdSet.has(id))) {
            throw new InvalidAiComparisonError(`relationships[${index}] must reference selected courses`);
        }
        return {
            type,
            courseIds,
            description: cleanRequiredText(item.description, `relationships[${index}].description`, 500)
        };
    });

    const learningOrder = value.learningOrder.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new InvalidAiComparisonError(`learningOrder[${index}] must be an object`);
        }
        const courseId = Number(item.courseId);
        if (!selectedIdSet.has(courseId)) {
            throw new InvalidAiComparisonError(`learningOrder[${index}].courseId is not selected`);
        }
        return {
            courseId,
            position: index + 1,
            reason: cleanRequiredText(item.reason, `learningOrder[${index}].reason`, 500)
        };
    });
    // Reject missing or repeated courses instead of presenting an incomplete learning order.
    const returnedIds = learningOrder.map(item => item.courseId);
    if (learningOrder.length !== selectedIds.length
        || new Set(returnedIds).size !== returnedIds.length
        || selectedIds.some(id => !returnedIds.includes(id))) {
        throw new InvalidAiComparisonError('learningOrder must contain every selected course exactly once');
    }

    const cleanTextArray = (items, field) => {
        if (items === undefined) return [];
        if (!Array.isArray(items)) throw new InvalidAiComparisonError(`${field} must be an array`);
        return items.map(item => cleanRequiredText(item, field, 500)).slice(0, 8);
    };

    return {
        summary: cleanRequiredText(value.summary, 'summary', 2000),
        relationships,
        learningOrder,
        strengths: cleanTextArray(value.strengths, 'strengths'),
        tradeoffs: cleanTextArray(value.tradeoffs, 'tradeoffs'),
        recommendation: cleanOptionalText(value.recommendation, 1000),
        limitations: cleanOptionalText(value.limitations, 1000)
    };
};

const schemaText = `{
  "summary": "plain-text group summary",
  "relationships": [
    {
      "type": "prerequisite | complementary | workload | assessment | overlap | other",
      "courseIds": [1, 2],
      "description": "plain-text evidence-based relationship"
    }
  ],
  "learningOrder": [
    { "courseId": 1, "reason": "plain-text reason" }
  ],
  "strengths": ["plain text"],
  "tradeoffs": ["plain text"],
  "recommendation": "plain text",
  "limitations": "plain text"
}`;

const buildSystemPrompt = (courses) => {
    const courseList = courses.map(course => `${course.id}: ${course.code} ${course.name}`).join('; ');
    const ids = courses.map(course => course.id).join(', ');
    return `You are CourseCompass's course comparison assistant.
Return ONLY one valid JSON object. Do not use Markdown, code fences, commentary, or text before or after JSON.
Use only supplied course data, prerequisite relationships, and approved review evidence. Do not invent facts.
Compare the courses as a group, covering prerequisites, complementary topics, overlap, workload, assessment, and learning order where supported.
Selected courses (${courses.length} total): ${courseList}.
The learningOrder array is mandatory and must contain every selected course ID exactly once. Its IDs must be exactly [${ids}], ordered from the most sensible course to study first through last. Never omit a course, even when evidence is limited; explain the uncertainty in its reason.
Every relationship courseIds entry may contain only selected IDs and must contain at least two IDs.
Allowed relationship types are prerequisite, complementary, workload, assessment, overlap, and other.
All text values must be plain text.
Required JSON shape:
${schemaText}`;
};

const generateComparisonAnalysis = async ({ courses, chatCompletion }) => {
    const systemPrompt = buildSystemPrompt(courses);
    const userContent = `Selected course data:\n${JSON.stringify(courses, null, 2)}`;
    const raw = await chatCompletion({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
        temperature: 0.2,
        maxTokens: 2400
    });

    try {
        return validateCompareResponse(parseAiJsonResponse(raw), courses);
    } catch (firstError) {
        if (!(firstError instanceof InvalidAiComparisonError)) throw firstError;
        // Allow one schema-repair attempt to bound provider calls and response latency.
        const repairPrompt = `${systemPrompt}
Your previous response failed schema validation: ${firstError.message}.
Repair it now. Return ONLY the corrected JSON object. Ensure learningOrder includes every selected ID exactly once.`;
        const repaired = await chatCompletion({
            messages: [
                { role: 'system', content: repairPrompt },
                { role: 'user', content: `${userContent}\n\nInvalid previous response:\n${String(raw).slice(0, 12000)}` }
            ],
            temperature: 0,
            maxTokens: 2400
        });
        try {
            return validateCompareResponse(parseAiJsonResponse(repaired), courses);
        } catch (repairError) {
            if (repairError instanceof InvalidAiComparisonError) {
                throw new InvalidAiComparisonError('AI comparison remained invalid after one repair attempt');
            }
            throw repairError;
        }
    }
};

module.exports = {
    InvalidAiComparisonError,
    parseAiJsonResponse,
    validateCompareResponse,
    generateComparisonAnalysis,
    buildSystemPrompt
};
