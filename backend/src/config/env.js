require('dotenv').config();

const toInt = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};

module.exports = {
    port: toInt(process.env.PORT, 3010),
    nodeEnv: process.env.NODE_ENV || 'development',
    
    db: {
        // NOTE: Major migration change - SQL host/user/password replaced by URI.
        uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/daymap',
        name: process.env.MONGODB_DB_NAME || 'daymap'
    },
    
    jwt: {
        secret: process.env.JWT_SECRET || 'fallback_secret_key',
        expire: process.env.JWT_EXPIRE || '7d',
        refreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d'
    },
    
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
    },
    
    rateLimit: {
        windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 900000), // 15 minutes
        max: toInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100)
    },
    
    bcrypt: {
        rounds: toInt(process.env.BCRYPT_ROUNDS, 10)
    }
};
