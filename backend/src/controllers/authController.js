const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userService = require('../services/userService');
const emailService = require('../services/emailService');

const register = async (req, res) => {
    try {
        const { email, password, name, major, studyYear } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and name are required'
            });
        }

        const newUser = await userService.createUser({
            email,
            password,
            name,
            major,
            studyYear,
            role: 'STUDENT'
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: newUser
        });

    } catch (error) {
        console.error('Registration Error:', error);

        if (error instanceof TypeError) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.code === 'P2002') {
            return res.status(409).json({
                success: false,
                message: 'This email is already registered'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server Error during registration'
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const allowedRoles = ['STUDENT', 'MODERATOR', 'ADMIN'];

        if (!email || !password || !allowedRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and a valid account type are required'
            });
        }

        const user = await userService.findUserForAuthenticationByEmail(email);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email, password, or account type'
            });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email, password, or account type'
            });
        }

        if (user.role !== role) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email, password, or account type'
            });
        }

        const payload = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        const { passwordHash, ...safeUser } = user;

        res.status(200).json({
            success: true,
            message: 'User logged in successfully',
            token: token,
            data: safeUser
        });

    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error during login'
        });
    }
};

const forgotPassword = async(req, res) => {
    try{
        const { email } = req.body;

        if(!email){
            return res.status(400).json({
                success : false,
                message : 'Email is required'
            });
        }

        const resetCode = await userService.generateResetCode(email);

        if (resetCode) {
            try {
                await emailService.sendResetEmail(email, resetCode);
                console.log(`[Email Success] Reset email sent successfully to ${email}`);
            } catch (emailError) {
                console.error('[Email Error] Failed to send reset email:', {
                    code: emailError.code || 'UNKNOWN',
                    responseCode: emailError.responseCode || null,
                    command: emailError.command || null,
                    message: emailError.message,
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'If that email address is in our database, we will send you an email with a reset code.'
        });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error during password reset request'
        });
    }
}

const resetPassword = async (req, res) => {
    try {
        const { email, resetCode, newPassword } = req.body;

        if (!email || !resetCode || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email, reset code, and new password are required'
            });
        }

        await userService.resetPassword(email, resetCode, newPassword);

        res.status(200).json({
            success: true,
            message: 'Password has been successfully reset'
        });

    } catch (error) {
        console.error('Reset Password Error:', error);

        if (error instanceof TypeError) {
            return res.status(400).json({ success: false, message: error.message });
        }

        if (error.message === 'Invalid code') {
            return res.status(400).json({
                success: false,
                message: 'Invalid reset code or email'
            });
        }

        if (error.message === 'Code expired') {
            return res.status(400).json({
                success: false,
                message: 'Reset code has expired. Please request a new one'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server Error during password reset'
        });
    }
};

module.exports = {
    register,
    login,
    forgotPassword,
    resetPassword
};

