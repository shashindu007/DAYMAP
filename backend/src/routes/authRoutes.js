const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const {
    registerValidation,
    loginValidation,
    updateProfileValidation,
    changePasswordValidation
} = require('../middleware/validator');

// Public routes
router.post('/register', authLimiter, registerValidation, AuthController.register);
router.post('/login', authLimiter, loginValidation, AuthController.login);

// Protected routes
router.get('/me', authMiddleware, AuthController.getCurrentUser);
router.put('/update-profile', authMiddleware, updateProfileValidation, AuthController.updateProfile);
router.put('/change-password', authMiddleware, changePasswordValidation, AuthController.changePassword);
router.post('/logout', authMiddleware, AuthController.logout);

module.exports = router;
