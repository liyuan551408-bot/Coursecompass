const nodemailer = require('nodemailer');
const smtpPort = Number(process.env.SMTP_PORT || 465);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort === 587,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendResetEmail = async (toEmail, resetCode) => {
    const mailOptions = {
        from: `"Course Compass" <${process.env.SMTP_USER}>`, 
        to: toEmail,                                           
        subject: 'Account password reset code',                         
        html: `
            <div style="padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2>Password reset request</h2>
                <p>You are trying to reset your account password. Your verification code is:</p>
                <h1 style="color: #007bff; letter-spacing: 5px; background: #f4f4f4; padding: 10px; display: inline-block;">${resetCode}</h1>
            <p>This code will expire in <strong>10 minutes</strong>. Please enter it as soon as possible.</p>
            </div>
        `
    };
    await transporter.sendMail(mailOptions);
};

module.exports = { sendResetEmail };
