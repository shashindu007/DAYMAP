const rateLimit = require('express-rate-limit');
const config = require('../config/env');

/**
 * General rate limiter for all API routes
 */
const LOCAL_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

const generalLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Never throttle local traffic in development — a data-heavy SPA makes
    // several API calls per page, which would otherwise trip the limiter
    // during normal navigation. Production traffic is still limited.
    skip: (req) => config.nodeEnv !== 'production' && LOCAL_IPS.includes(req.ip)
});

/**
 * Strict rate limiter for authentication routes
 */
const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // 20 requests per window
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 5 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Don't count successful requests
});

/**
 * Rate limiter for task creation
 */
const taskCreationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 tasks per minute
    message: {
        success: false,
        message: 'Too many tasks created. Please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    generalLimiter,
    authLimiter,
    taskCreationLimiter
};
