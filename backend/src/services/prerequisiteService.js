const resolvePrerequisiteCourses = async (prisma, rawReferences) => {
    if (!Array.isArray(rawReferences)) {
        throw new TypeError('prerequisiteIds must be an array');
    }

    const references = [...new Set(rawReferences.map((value) => String(value).trim()).filter(Boolean))];
    if (!references.length) return [];

    const isNumeric = (value) => /^\d+$/.test(value);
    const codeAlias = (value) => /^\d{6}$/.test(value)
        ? `${value.slice(0, 3)}.${value.slice(3)}`
        : value.toUpperCase();
    const numericIds = references.filter(isNumeric).map(Number).filter(Number.isSafeInteger);
    const courseCodes = [...new Set(references
        .filter((value) => !isNumeric(value) || /^\d{6}$/.test(value))
        .flatMap((value) => [value.toUpperCase(), codeAlias(value)]))];
    const lookup = [];
    if (numericIds.length) lookup.push({ id: { in: numericIds } });
    if (courseCodes.length) lookup.push({ code: { in: courseCodes } });

    const courses = lookup.length
        ? await prisma.course.findMany({ where: { OR: lookup }, select: { id: true, code: true } })
        : [];
    const byId = new Map(courses.map((course) => [course.id, course]));
    const byCode = new Map(courses.map((course) => [course.code.toUpperCase(), course]));
    const resolve = (reference) => {
        if (/^\d{6}$/.test(reference)) {
            return byCode.get(reference) || byCode.get(codeAlias(reference)) || byId.get(Number(reference));
        }
        return isNumeric(reference) ? byId.get(Number(reference)) : byCode.get(reference.toUpperCase());
    };
    const missing = references.filter((reference) => !resolve(reference));
    if (missing.length) {
        const error = new Error('One or more prerequisite courses do not exist');
        error.code = 'PREREQUISITE_NOT_FOUND';
        error.meta = { missing };
        throw error;
    }

    return [...new Map(references.map((reference) => {
        const course = resolve(reference);
        return [course.id, course];
    })).values()];
};

module.exports = { resolvePrerequisiteCourses };
