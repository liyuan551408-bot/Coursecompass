const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const prisma = require('../../src/lib/prisma');

const run = async () => {
    const prefix = `TEST.PREREQ.${randomUUID().slice(0, 8).toUpperCase()}`;
    const codes = [1, 2, 3, 4].map((number) => `${prefix}.${number}`);

    try {
        const fundamentals = await prisma.course.create({
            data: { code: codes[0], name: 'Prerequisite Test Fundamentals', credits: 15 }
        });
        const algorithms = await prisma.course.create({
            data: {
                code: codes[1], name: 'Prerequisite Test Algorithms', credits: 15,
                prerequisites: { connect: { id: fundamentals.id } }
            }
        });
        const softwareEngineering = await prisma.course.create({
            data: { code: codes[2], name: 'Prerequisite Test Software Engineering', credits: 15 }
        });
        const programmingProject = await prisma.course.create({
            data: {
                code: codes[3], name: 'Prerequisite Test Project', credits: 15,
                prerequisites: { connect: [{ id: algorithms.id }, { id: softwareEngineering.id }] }
            }
        });

        const [algorithmsWithPrerequisites, projectWithPrerequisites] = await Promise.all([
            prisma.course.findUnique({
                where: { id: algorithms.id },
                select: { prerequisites: { select: { id: true }, orderBy: { id: 'asc' } } }
            }),
            prisma.course.findUnique({
                where: { id: programmingProject.id },
                select: { prerequisites: { select: { id: true }, orderBy: { id: 'asc' } } }
            })
        ]);

        assert.deepEqual(
            algorithmsWithPrerequisites.prerequisites.map((course) => course.id),
            [fundamentals.id]
        );
        assert.deepEqual(
            projectWithPrerequisites.prerequisites.map((course) => course.id),
            [algorithms.id, softwareEngineering.id].sort((left, right) => left - right)
        );
        assert.equal(
            projectWithPrerequisites.prerequisites.some((course) => course.id === programmingProject.id),
            false
        );

        console.log('Prerequisites smoke test passed.');
    } finally {
        await prisma.course.deleteMany({ where: { code: { in: codes } } });
    }
};

run()
    .catch((error) => {
        console.error('Prerequisites smoke test failed.');
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
