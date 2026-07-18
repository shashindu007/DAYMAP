/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error. Do NOT echo raw err.message to the client for unexpected
    // errors — it can leak internal detail. Known cases below set safe messages.
    let statusCode = err.statusCode || 500;
    let message = statusCode >= 500 ? 'Internal Server Error' : (err.message || 'Request failed');
    
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

    // Payload too large (e.g., profile image upload body)
    if (err.type === 'entity.too.large' || err.status === 413) {
        statusCode = 413;
        message = 'Uploaded content is too large. Please use a smaller image.';
    }
    
    // Stack traces are logged server-side only (see console.error above) and are
    // never returned to the client, in any environment.
    res.status(statusCode).json({
        success: false,
        message
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
