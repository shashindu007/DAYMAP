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
 * Validation rules for profile update
 */
const updateProfileValidation = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('timezone')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Timezone must not exceed 100 characters'),
    body('profile_image')
        .optional({ nullable: true })
        .isString().withMessage('profile_image must be a string')
        .isLength({ max: 3000000 }).withMessage('Profile image payload is too large'),
    body('bio')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 500 }).withMessage('Bio must not exceed 500 characters'),
    body('phone')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 30 }).withMessage('Phone must not exceed 30 characters'),
    body('location')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 120 }).withMessage('Location must not exceed 120 characters'),
    handleValidationErrors
];

/**
 * Validation rules for password change
 */
const changePasswordValidation = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
    handleValidationErrors
];

/**
 * Validation rules for analytics query parameters
 */
const analyticsWeeklyQueryValidation = [
    query('start_date')
        .optional()
        .isDate({ format: 'YYYY-MM-DD' }).withMessage('start_date must be in YYYY-MM-DD format'),
    query('end_date')
        .optional()
        .isDate({ format: 'YYYY-MM-DD' }).withMessage('end_date must be in YYYY-MM-DD format'),
    handleValidationErrors
];

const analyticsMonthlyQueryValidation = [
    query('year')
        .optional()
        .isInt({ min: 2000, max: 2100 }).withMessage('year must be between 2000 and 2100'),
    query('month')
        .optional()
        .isInt({ min: 1, max: 12 }).withMessage('month must be between 1 and 12'),
    handleValidationErrors
];

const analyticsTrendsQueryValidation = [
    query('days')
        .optional()
        .isInt({ min: 1, max: 365 }).withMessage('days must be between 1 and 365'),
    handleValidationErrors
];

const analyticsFocusPatternsQueryValidation = [
    query('days')
        .optional()
        .isInt({ min: 1, max: 365 }).withMessage('days must be between 1 and 365'),
    handleValidationErrors
];

const focusSessionValidation = [
    body('date')
        .isDate({ format: 'YYYY-MM-DD' }).withMessage('date must be in YYYY-MM-DD format'),
    body('start_time')
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('start_time must be HH:MM or HH:MM:SS'),
    body('end_time')
        .optional({ nullable: true })
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('end_time must be HH:MM or HH:MM:SS'),
    body('duration_minutes')
        .isInt({ min: 1, max: 1440 }).withMessage('duration_minutes must be between 1 and 1440'),
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
 * Validation rules for full-day scheduling payload
 */
const dayScheduleValidation = [
    body('date')
        .isDate({ format: 'YYYY-MM-DD' }).withMessage('date must be in YYYY-MM-DD format'),
    body('replaceExisting')
        .optional()
        .isBoolean().withMessage('replaceExisting must be a boolean'),
    body('slots')
        .isArray({ min: 1 }).withMessage('slots must be a non-empty array'),
    body('slots.*.title')
        .trim()
        .notEmpty().withMessage('Each slot requires a title')
        .isLength({ max: 255 }).withMessage('Slot title must not exceed 255 characters'),
    body('slots.*.start_time')
        .optional({ nullable: true })
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('start_time must be HH:MM or HH:MM:SS'),
    body('slots.*.end_time')
        .optional({ nullable: true })
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('end_time must be HH:MM or HH:MM:SS'),
    body('slots.*.priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid slot priority value'),
    body('slots.*.category')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 50 }).withMessage('Category must not exceed 50 characters'),
    body('slots.*.description')
        .optional({ nullable: true })
        .trim(),
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
 * Validation rules for resource ID parameters
 * NOTE: Accepts UUID or Mongo ObjectId to keep routes unchanged during DB migration.
 */
const uuidParamValidation = [
    param('id')
        .custom((value) => {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
            const isObjectId = /^[0-9a-fA-F]{24}$/.test(value);
            if (!isUuid && !isObjectId) {
                throw new Error('Invalid ID format');
            }
            return true;
        }),
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
    updateProfileValidation,
    changePasswordValidation,
    taskValidation,
    dayScheduleValidation,
    categoryValidation,
    routineValidation,
    uuidParamValidation,
    dateParamValidation,
    analyticsWeeklyQueryValidation,
    analyticsMonthlyQueryValidation,
    analyticsTrendsQueryValidation,
    analyticsFocusPatternsQueryValidation,
    focusSessionValidation
};
