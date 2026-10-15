const MAX_CONNECTIONS_PER_COURSE = 5;

const attachCompletedCourseConnections = (candidates = [], completedCourses = []) => {
    const completedById = new Map(completedCourses.map(course => [Number(course.id), course]));

    return candidates.map(candidate => {
        const connections = [];
        const connectedIds = new Set();

        for (const prerequisite of candidate.prerequisites || []) {
            const completed = completedById.get(Number(prerequisite.id));
            if (!completed || connectedIds.has(Number(completed.id))) continue;
            connections.push({
                id: completed.id,
                code: completed.code,
                name: completed.name,
                relationship: 'prerequisite'
            });
            connectedIds.add(Number(completed.id));
        }

        if (candidate.subjectId !== null && candidate.subjectId !== undefined) {
            for (const completed of completedCourses) {
                if (connections.length >= MAX_CONNECTIONS_PER_COURSE) break;
                if (connectedIds.has(Number(completed.id))) continue;
                if (Number(completed.subjectId) !== Number(candidate.subjectId)) continue;
                if (Number.isFinite(Number(candidate.level))
                    && Number.isFinite(Number(completed.level))
                    && Number(completed.level) > Number(candidate.level)) continue;
                connections.push({
                    id: completed.id,
                    code: completed.code,
                    name: completed.name,
                    relationship: 'same_subject'
                });
                connectedIds.add(Number(completed.id));
            }
        }

        return {
            ...candidate,
            completedCourseConnections: connections.slice(0, MAX_CONNECTIONS_PER_COURSE)
        };
    });
};

const collectRelevantCompletedCourses = candidates => {
    const relevant = new Map();
    for (const candidate of candidates || []) {
        for (const connection of candidate.completedCourseConnections || []) {
            if (!relevant.has(Number(connection.id))) {
                relevant.set(Number(connection.id), {
                    id: connection.id,
                    code: connection.code,
                    name: connection.name
                });
            }
        }
    }
    return [...relevant.values()];
};

module.exports = {
    attachCompletedCourseConnections,
    collectRelevantCompletedCourses
};
