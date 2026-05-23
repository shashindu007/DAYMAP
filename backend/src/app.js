const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const routineRoutes = require('./routes/routineRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');

// Initialize express app
const app = express();

// NOTE: Supports comma-separated CORS origins, e.g. "http://localhost:3000,http://localhost:3010"
const allowedOrigins = String(config.cors.origin || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

// Security middleware
app.use(helmet()); // Set security headers
app.use(cors({
    origin: (origin, callback) => {
        // Allow non-browser clients/tools without Origin header.
        if (!origin) return callback(null, true);

        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
}));

// Body parsing middleware
// Increased limit to support profile image uploads (Base64 payloads).
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Logging middleware
if (config.nodeEnv === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Rate limiting (disabled in development for smoother local testing)
if (config.nodeEnv !== 'development') {
    app.use('/api', generalLimiter);
}

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/routines', routineRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/schedules', scheduleRoutes);

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to Daily Routine & Workload Management System API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            tasks: '/api/tasks',
            categories: '/api/categories',
            routines: '/api/routines',
            analytics: '/api/analytics',
            schedules: '/api/schedules'
        }
    });
});

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
