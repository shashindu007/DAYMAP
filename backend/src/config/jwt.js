const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '30d';

if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is required in production environment');
    }
    // eslint-disable-next-line no-console
    console.warn('Warning: JWT_SECRET is missing. Using insecure development fallback secret.');
}

const RESOLVED_JWT_SECRET = JWT_SECRET || 'fallback_secret_key';

/**
 * Generate JWT access token
 * @param {Object} payload - Token payload
 * @returns {String} JWT token
 */
const generateToken = (payload) => {
    return jwt.sign(payload, RESOLVED_JWT_SECRET, {
        expiresIn: JWT_EXPIRE
    });
};

/**
 * Generate JWT refresh token
 * @param {Object} payload - Token payload
 * @returns {String} JWT refresh token
 */
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, RESOLVED_JWT_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRE
    });
};

/**
 * Verify JWT token
 * @param {String} token - JWT token
 * @returns {Object} Decoded token
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, RESOLVED_JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

module.exports = {
    generateToken,
    generateRefreshToken,
    verifyToken,
    JWT_SECRET: RESOLVED_JWT_SECRET
};
