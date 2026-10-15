require('dotenv').config({
    override: process.env.NODE_ENV !== 'production'
});

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:4173')
    .split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Origin is not allowed by CORS'));
    }
}));
app.use((_req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    });
    next();
});
app.use(express.json({ limit: '32kb' }));

const courseRoutes = require('./src/routes/courseRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const userRoutes = require('./src/routes/userRoutes');
const authRoutes = require('./src/routes/authRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');
const planRoutes = require('./src/routes/planRoutes');
const savedCourseRoutes = require('./src/routes/savedCourseRoutes');
const completedCourseRoutes = require('./src/routes/completedCourseRoutes');
const healthRoutes = require('./src/routes/healthRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const subjectRoutes = require('./src/routes/subjectRoutes');

app.use('/api/courses', courseRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/saved-courses', savedCourseRoutes);
app.use('/api/completed-courses', completedCourseRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subjects', subjectRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
    console.error('Unhandled request error:', error.message);
    res.status(500).json({ success: false, message: 'Unexpected server error' });
});

app.listen(PORT, () => {
    console.log('Your Express backend server has started successfully.');
    console.log(`Listening at: http://localhost:${PORT}`);
});
