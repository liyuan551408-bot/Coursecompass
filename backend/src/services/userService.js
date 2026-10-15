const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { validatePassword } = require('../utils/passwordPolicy');

const ASSESSMENT_TYPES = new Set(['EXAM', 'ASSIGNMENT', 'QUIZ', 'PROJECT', 'LAB', 'PRESENTATION']);
const WORKLOAD_PREFERENCES = new Set(['LIGHT', 'MODERATE', 'INTENSIVE']);

const normalizePlanningPreferences = (value) => {
    if (value === null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('planningPreferences must be an object');
    }

    const maxCredits = value.maxCreditsPerSemester;
    if (maxCredits !== null && maxCredits !== undefined
        && (!Number.isInteger(Number(maxCredits)) || Number(maxCredits) < 1 || Number(maxCredits) > 120)) {
        throw new TypeError('Maximum credits per semester must be a whole number between 1 and 120');
    }

    const assessmentTypes = value.preferredAssessmentTypes ?? [];
    if (!Array.isArray(assessmentTypes) || assessmentTypes.some(type => !ASSESSMENT_TYPES.has(type))) {
        throw new TypeError('Preferred assessment types contain an invalid value');
    }

    const preferredWorkload = value.preferredWorkload ?? null;
    if (preferredWorkload !== null && !WORKLOAD_PREFERENCES.has(preferredWorkload)) {
        throw new TypeError('Preferred workload must be light, moderate, or intensive');
    }
    if (value.avoidExamHeavy !== undefined && typeof value.avoidExamHeavy !== 'boolean') {
        throw new TypeError('avoidExamHeavy must be true or false');
    }

    return {
        maxCreditsPerSemester: maxCredits === null || maxCredits === undefined ? null : Number(maxCredits),
        preferredAssessmentTypes: [...new Set(assessmentTypes)],
        preferredWorkload,
        avoidExamHeavy: Boolean(value.avoidExamHeavy)
    };
};

const publicUserSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    major: true,
    createdAt: true,
    updatedAt: true,
    studyYear:true,
    interests:true,
    goals:true,
    planningPreferences:true

};

const normalizeEmail = (email) => {
    if (typeof email !== 'string' || email.trim() === '') {
        throw new TypeError('A valid email is required');
    }
    return email.trim().toLowerCase();
};

const findUserForAuthenticationByEmail = async (email) => {
    return prisma.user.findUnique({
        where: { email: normalizeEmail(email) },
        select: {
            id: true,
            email: true,
            passwordHash: true,
            name: true,
            role: true,
            major: true,
            studyYear: true,
            interests: true,
            goals: true,
            planningPreferences: true
        }
    });
};

const findPublicUserById = async (id) => {
    return prisma.user.findUnique({
        where: { id:Number(id) },
        select: publicUserSelect
    });
};

const createUser = async ({ email, password, name, major = null, studyYear = null, role = 'STUDENT' }) => {
    validatePassword(password);
    if (typeof name !== 'string' || name.trim() === '') {
        throw new TypeError('A user name is required');
    }
    if (!['STUDENT', 'MODERATOR', 'ADMIN'].includes(role)) {
        throw new TypeError('A valid user role is required');
    }

    const normalizedStudyYear = studyYear === null || studyYear === '' || studyYear === undefined
        ? null
        : Number(studyYear);
    if (normalizedStudyYear !== null && (!Number.isInteger(normalizedStudyYear) || normalizedStudyYear < 1 || normalizedStudyYear > 8)) {
        throw new TypeError('Study year must be a whole number between 1 and 8');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    return prisma.user.create({
        data: {
            email: normalizeEmail(email),
            passwordHash,
            name: name.trim(),
            role,
            major: typeof major === 'string' && major.trim() !== '' ? major.trim() : null,
            studyYear: normalizedStudyYear
        },
        select: publicUserSelect
    });
};

const generateResetCode = async (email) => {
    const user = await prisma.user.findUnique({where:{ email: normalizeEmail(email)}});

    if(!user) return null;

    const resetCode = crypto.randomInt(100000,1000000).toString();

    const resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
    const resetCodeHash = crypto.createHash('sha256').update(resetCode).digest('hex');
    await prisma.user.update({
        where: {id: user.id},
        data:{
            resetCode: resetCodeHash,
            resetCodeExpires
        }
    });

    return resetCode;
}

const resetPassword = async (email, resetCode, newPassword) => {
    validatePassword(newPassword);
    if (typeof resetCode !== 'string' || !/^\d{6}$/.test(resetCode)) {
        throw new Error('Invalid code');
    }
    const resetCodeHash = crypto.createHash('sha256').update(resetCode).digest('hex');
    const user = await prisma.user.findFirst({
        where: { 
            email: normalizeEmail(email),
            resetCode: resetCodeHash
        }
    });

    if (!user) {
        throw new Error('Invalid code');
    }

    if (new Date() > user.resetCodeExpires) {
        throw new Error('Code expired');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash: passwordHash,
            resetCode: null,
            resetCodeExpires: null
        }
    });

    return true;
};

const updateUserProfile = async (id, data) => {
    const currentUser = await prisma.user.findUnique({
        where: { id: Number(id) },
        select: { role: true }
    });
    if (!currentUser) throw new TypeError('User not found');

    const studentOnlyFields = ['major', 'studyYear', 'interests', 'goals', 'planningPreferences'];
    if (currentUser.role !== 'STUDENT' && studentOnlyFields.some((field) => data[field] !== undefined)) {
        const error = new Error('Academic profile fields are available to students only');
        error.statusCode = 403;
        throw error;
    }

    const updateData = {};
    if (data.name !== undefined) {
        if (typeof data.name !== 'string' || !data.name.trim()) throw new TypeError('Name is required');
        updateData.name = data.name.trim();
    }
    if (data.major !== undefined) {
        updateData.major = typeof data.major === 'string' && data.major.trim() ? data.major.trim() : null;
    }
    if (data.studyYear !== undefined) {
        const value = data.studyYear === null || data.studyYear === '' ? null : Number(data.studyYear);
        if (value !== null && (!Number.isInteger(value) || value < 1 || value > 8)) {
            throw new TypeError('Study year must be a whole number between 1 and 8');
        }
        updateData.studyYear = value;
    }
    for (const field of ['interests', 'goals']) {
        if (data[field] !== undefined) {
            if (!Array.isArray(data[field]) || data[field].some((value) => typeof value !== 'string')) {
                throw new TypeError(`${field} must be an array of text values`);
            }
            const values = [...new Set(data[field].map((value) => value.trim()).filter(Boolean))];
            if (values.length > 20 || values.some(value => value.length > 100)) {
                throw new TypeError(`${field} must contain at most 20 values of 100 characters or fewer`);
            }
            updateData[field] = values;
        }
    }
    if (data.planningPreferences !== undefined) {
        updateData.planningPreferences = normalizePlanningPreferences(data.planningPreferences);
    }
    return prisma.user.update({
        where: { id:Number(id) },
        data: updateData,
        select: publicUserSelect
    });
};

module.exports = {
    normalizeEmail,
    findUserForAuthenticationByEmail,
    findPublicUserById,
    createUser,
    generateResetCode,
    resetPassword,
    updateUserProfile,
    normalizePlanningPreferences
};
