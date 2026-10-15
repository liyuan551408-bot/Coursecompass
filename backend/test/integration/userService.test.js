const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');

const prisma = require('../../src/lib/prisma');
const userService = require('../../src/services/userService');

const TEST_EMAIL = 'day2.student@coursecompass.test';
const TEST_PASSWORD = 'Day2Test123!';
const NEW_PASSWORD = 'Day2Changed456!';

const run = async () => {
    await prisma.user.deleteMany({
        where: {
            email: TEST_EMAIL
        }
    });

    const createdUser = await userService.createUser({
        email: '  DAY2.Student@CourseCompass.Test  ',
        password: TEST_PASSWORD,
        name: 'Day 2 Student',
        major: 'Software Engineering'
    });

    assert.equal(createdUser.email, TEST_EMAIL);
    assert.equal(createdUser.role, 'STUDENT');
    assert.equal('passwordHash' in createdUser, false);
    assert.equal('resetCode' in createdUser, false);
    assert.equal('resetCodeExpires' in createdUser, false);

    const authenticationUser =
        await userService.findUserForAuthenticationByEmail(
            'DAY2.STUDENT@COURSECOMPASS.TEST'
        );

    assert.ok(authenticationUser);
    assert.equal(authenticationUser.email, TEST_EMAIL);

    const passwordMatches = await bcrypt.compare(
        TEST_PASSWORD,
        authenticationUser.passwordHash
    );

    assert.equal(passwordMatches, true);

    const publicUser =
        await userService.findPublicUserById(createdUser.id);

    assert.ok(publicUser);
    assert.equal('passwordHash' in publicUser, false);
    assert.equal('resetCode' in publicUser, false);
    assert.equal('resetCodeExpires' in publicUser, false);

    await assert.rejects(
        () =>
            userService.createUser({
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
                name: 'Duplicate User'
            }),
        (error) => error.code === 'P2002'
    );

    const resetCode =
        await userService.generateResetCode(TEST_EMAIL);

    assert.match(resetCode, /^\d{6}$/);

    const userWithResetCode = await prisma.user.findUnique({
        where: {
            email: TEST_EMAIL
        },
        select: {
            resetCode: true,
            resetCodeExpires: true
        }
    });

    assert.equal(
        userWithResetCode.resetCode,
        crypto.createHash('sha256').update(resetCode).digest('hex')
    );
    assert.notEqual(userWithResetCode.resetCode, resetCode);
    assert.ok(userWithResetCode.resetCodeExpires instanceof Date);
    assert.ok(userWithResetCode.resetCodeExpires > new Date());

    await prisma.user.update({
        where: {
            email: TEST_EMAIL
        },
        data: {
            resetCodeExpires: new Date(Date.now() - 1000)
        }
    });

    await assert.rejects(
        () =>
            userService.resetPassword(
                TEST_EMAIL,
                resetCode,
                NEW_PASSWORD
            ),
        (error) => error.message === 'Code expired'
    );

    const validResetCode =
        await userService.generateResetCode(TEST_EMAIL);

    assert.match(validResetCode, /^\d{6}$/);

    const resetResult = await userService.resetPassword(
        TEST_EMAIL,
        validResetCode,
        NEW_PASSWORD
    );

    assert.equal(resetResult, true);

    const userAfterReset = await prisma.user.findUnique({
        where: {
            email: TEST_EMAIL
        },
        select: {
            passwordHash: true,
            resetCode: true,
            resetCodeExpires: true
        }
    });

    const newPasswordMatches = await bcrypt.compare(
        NEW_PASSWORD,
        userAfterReset.passwordHash
    );

    const oldPasswordMatches = await bcrypt.compare(
        TEST_PASSWORD,
        userAfterReset.passwordHash
    );

    assert.equal(newPasswordMatches, true);
    assert.equal(oldPasswordMatches, false);
    assert.equal(userAfterReset.resetCode, null);
    assert.equal(userAfterReset.resetCodeExpires, null);

    console.log('User Service smoke test passed.');
};

run()
    .catch((error) => {
        console.error('User Service smoke test failed.');
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.user.deleteMany({
            where: {
                email: TEST_EMAIL
            }
        });

        await prisma.$disconnect();
    });
