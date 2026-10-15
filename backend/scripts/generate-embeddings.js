require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { refreshCourseEmbedding } = require('../src/services/courseEmbeddingService');

const prisma = new PrismaClient();

async function main() {
    const force = process.argv.includes('--force');
    console.log(`Starting course embedding initialization (${force ? 'full rebuild' : 'missing vectors only'})...`);
    let succeeded = 0;
    let failed = 0;
    try {
        const courses = force
            ? await prisma.course.findMany()
            : await prisma.$queryRawUnsafe(`
                SELECT id, code, name, description, credits, level,
                       "offeredSemesters", "assessmentTypes", "workloadHours", "officialLink"
                FROM "Course"
                WHERE embedding IS NULL
                ORDER BY id;
            `);
        console.log(`Found ${courses.length} course(s) to process.`);
        if (courses.length === 0) {
            console.log('No courses found in the database. Add test courses through the frontend or database console first.');
            return;
        }
        for (const course of courses) {
            try {
                console.log(`Generating embedding for ${course.code}...`);
                await refreshCourseEmbedding(course);
                succeeded += 1;
                console.log(`Embedding updated: ${course.code}`);
            } catch (error) {
                failed += 1;
                console.error(`Failed to generate embedding for ${course.code}: ${error.message}`);
            }
        }
        console.log(`Embedding initialization finished. Succeeded: ${succeeded}; failed: ${failed}.`);
        if (failed > 0) process.exitCode = 1;

    } catch (error) {
        console.error('Embedding generation script failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
