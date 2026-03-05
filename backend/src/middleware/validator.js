const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    
    next();
};

/**
 * Validation rules for user registration
 */
const registerValidation = [
    body('email')
        .trim()
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('timezone')
        .optional()
        .trim(),
    handleValidationErrors
];

/**
 * Validation rules for user login
 */
const loginValidation = [
    body('email')
        .trim()
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required'),
    handleValidationErrors
];

/**
 * Validation rules for creating/updating tasks
 */
const taskValidation = [
    body('title')
        .trim()
        .notEmpty().withMessage('Task title is required')
        .isLength({ max: 255 }).withMessage('Title must not exceed 255 characters'),
    body('description')
        .optional()
        .trim(),
    body('category')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Category must not exceed 50 characters'),
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority value'),
    body('status')
        .optional()
        .isIn(['pending', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status value'),
    body('scheduled_date')
        .optional()
        .isDate({ format: 'YYYY-MM-DD' }).withMessage('Date must be in YYYY-MM-DD format'),
    body('scheduled_time')
        .optional()
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).withMessage('Time must be in HH:MM:SS format'),
    body('duration_minutes')
        .optional()
        .isInt({ min: 1 }).withMessage('Duration must be a positive integer'),
    body('is_recurring')
        .optional()
        .isBoolean().withMessage('is_recurring must be a boolean'),
    handleValidationErrors
];

/**
 * Validation rules for creating/updating categories
 */
const categoryValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Category name is required')
        .isLength({ max: 100 }).withMessage('Name must not exceed 100 characters'),
    body('color')
        .optional()
        .matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex code'),
    body('icon')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Icon must not exceed 50 characters'),
    handleValidationErrors
];

/**
 * Validation rules for creating/updating routines
 */
const routineValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Routine name is required')
        .isLength({ max: 100 }).withMessage('Name must not exceed 100 characters'),
    body('description')
        .optional()
        .trim(),
    body('routine_type')
        .optional()
        .isIn(['morning', 'afternoon', 'evening', 'custom']).withMessage('Invalid routine type'),
    body('is_active')
        .optional()
        .isBoolean().withMessage('is_active must be a boolean'),
    handleValidationErrors
];

/**
 * Validation rules for UUID parameters
 */
const uuidParamValidation = [
    param('id')
        .isUUID().withMessage('Invalid ID format'),
    handleValidationErrors
];

/**
 * Validation rules for date parameters
 */
const dateParamValidation = [
    param('date')
        .isDate({ format: 'YYYY-MM-DD' }).withMessage('Date must be in YYYY-MM-DD format'),
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    registerValidation,
    loginValidation,
    taskValidation,
    categoryValidation,
    routineValidation,
    uuidParamValidation,
    dateParamValidation
};
