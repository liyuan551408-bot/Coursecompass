require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
}

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
});

// Reuse the client across development reloads to avoid extra connection pools.
const prisma =
    globalThis.prisma ||
    new PrismaClient({
        adapter
    });

if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = prisma;
}

module.exports = prisma;
