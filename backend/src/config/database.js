const mongoose = require('mongoose');
require('dotenv').config();

// NOTE: Major migration change - SQL pool removed; backend now uses Mongoose.
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/daymap';

// Keep function name for minimal changes in server bootstrap logic.
const testConnection = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            autoIndex: true,
            serverSelectionTimeoutMS: 10000
        });
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
};

module.exports = { mongoose, testConnection };
