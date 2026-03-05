const rateLimit = require('express-rate-limit');
const config = require('../config/env');

/**
 * General rate limiter for all API routes
 */
const generalLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Strict rate limiter for authentication routes
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 15 minutes.'
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
