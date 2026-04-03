/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    
    // Mongo duplicate key
    if (err.code === 11000) {
        statusCode = 400;
        message = 'Duplicate entry. This record already exists.';
    }
    
    if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid identifier or field type.';
    }
    
    if (err.name === 'MongoServerError' && err.message?.includes('E11000')) {
        statusCode = 400;
        message = 'Duplicate entry. This record already exists.';
    }
    
    // JSON web token errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
    }
    
    // Validation errors
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message;
    }
    
    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

/**
 * 404 Not found handler
 */
const notFound = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
};

module.exports = {
    errorHandler,
    notFound
};
