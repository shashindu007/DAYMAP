require('dotenv').config();
const app = require('./app');
const config = require('./config/env');
const { testConnection } = require('./config/database');

const PORT = config.port;

// Test database connection before starting server
const startServer = async () => {
    try {
        // Test database connection
        await testConnection();
        
        // Start server
        app.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════════════════════════╗
║   Daily Routine & Workload Management System - Backend    ║
╚════════════════════════════════════════════════════════════╝

🚀 Server running on port ${PORT}
🌍 Environment: ${config.nodeEnv}
📡 API URL: http://localhost:${PORT}
🔍 Health check: http://localhost:${PORT}/health
📚 API Documentation: http://localhost:${PORT}

Press CTRL+C to stop the server
            `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Promise Rejection:', err);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

// Start the server
startServer();
