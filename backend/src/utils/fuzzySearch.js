const normalizeText = (value) => String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const levenshteinDistance = (left, right) => {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;

    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex];
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
            current[rightIndex] = Math.min(
                current[rightIndex - 1] + 1,
                previous[rightIndex] + 1,
                previous[rightIndex - 1] + substitutionCost
            );
        }
        previous = current;
    }
    return previous[right.length];
};

const similarity = (left, right) => {
    if (!left || !right) return 0;
    if (left === right) return 1;
    return 1 - (levenshteinDistance(left, right) / Math.max(left.length, right.length));
};

const scoreCourse = (course, normalizedQuery) => {
    const searchableText = normalizeText([course.code, course.name, course.description].filter(Boolean).join(' '));
    const queryTokens = normalizedQuery.split(' ').filter(Boolean);
    const courseTokens = searchableText.split(' ').filter(Boolean);
    const compactQuery = normalizedQuery.replace(/\s/g, '');
    const compactCode = normalizeText(course.code).replace(/\s/g, '');
    const nameInitials = normalizeText(course.name)
        .split(' ')
        .filter(Boolean)
        .map(word => word[0])
        .join('');

    if (compactQuery.length <= 2) {
        const exactTokenMatch = queryTokens.length === 1 && courseTokens.includes(normalizedQuery);
        const codeMatch = compactCode.includes(compactQuery);
        const initialsMatch = compactQuery.length === 2 && nameInitials.includes(compactQuery);
        return exactTokenMatch || codeMatch || initialsMatch ? 1 : 0;
    }

    if (searchableText.includes(normalizedQuery)) return 1;

    const tokenScore = queryTokens.reduce((total, queryToken) => {
        const bestMatch = courseTokens.reduce(
            (best, courseToken) => Math.max(best, similarity(queryToken, courseToken)),
            0
        );
        return total + bestMatch;
    }, 0) / queryTokens.length;

    return Math.max(tokenScore, similarity(compactQuery, compactCode));
};

const rankFuzzyCourses = (courses, query) => {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return courses;

    const minimumScore = normalizedQuery.replace(/\s/g, '').length <= 2 ? 1 : 0.58;
    return courses
        .map(course => ({ course, score: scoreCourse(course, normalizedQuery) }))
        .filter(result => result.score >= minimumScore)
        .sort((left, right) => right.score - left.score || left.course.code.localeCompare(right.course.code))
        .map(result => result.course);
};

module.exports = { rankFuzzyCourses };
