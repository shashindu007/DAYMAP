const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('../config/jwt');
const config = require('../config/env');

class AuthController {
    /**
     * Register a new user
     * @route POST /api/auth/register
     */
    static async register(req, res) {
        try {
            const { email, password, name, timezone } = req.body;
            
            // Check if user already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already registered'
                });
            }
            
            // Hash password
            const password_hash = await bcrypt.hash(password, config.bcrypt.rounds);
            
            // Create user
            const user = await User.create({
                email,
                password_hash,
                name,
                timezone: timezone || 'UTC'
            });
            
            // Generate tokens
            const token = generateToken({ id: user.id, email: user.email });
            const refreshToken = generateRefreshToken({ id: user.id });
            
            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user,
                    token,
                    refreshToken
                }
            });
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({
                success: false,
                message: 'Error registering user',
                error: error.message
            });
        }
    }
    
    /**
     * Login user
     * @route POST /api/auth/login
     */
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            
            // Find user with password
            const user = await User.findByEmailWithPassword(email);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }
            
            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }
            
            // Generate tokens
            const token = generateToken({ id: user.id, email: user.email });
            const refreshToken = generateRefreshToken({ id: user.id });
            
            // Remove password hash from response
            delete user.password_hash;
            
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user,
                    token,
                    refreshToken
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Error logging in',
                error: error.message
            });
        }
    }
    
    /**
     * Get current user
     * @route GET /api/auth/me
     */
    static async getCurrentUser(req, res) {
        try {
            const user = await User.findById(req.user.id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
            
            res.json({
                success: true,
                data: user
            });
        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching user data',
                error: error.message
            });
        }
    }
    
    /**
     * Update user profile
     * @route PUT /api/auth/update-profile
     */
    static async updateProfile(req, res) {
        try {
            const { name, email, timezone, profile_image, bio, phone, location } = req.body;
            
            // If email is being changed, check if it's already taken
            if (email && email !== req.user.email) {
                const existingUser = await User.findByEmail(email);
                if (existingUser) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email already in use'
                    });
                }
            }
            
            const updatedUser = await User.update(req.user.id, {
                name,
                email,
                timezone,
                profile_image,
                bio,
                phone,
                location
            });
            
            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: updatedUser
            });
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating profile',
                error: error.message
            });
        }
    }
    
    /**
     * Change password
     * @route PUT /api/auth/change-password
     */
    static async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            
            // Get user with password
            const user = await User.findByEmailWithPassword(req.user.email);
            
            // Verify current password
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }
            
            // Hash new password
            const newPasswordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds);
            
            // Update password
            await User.updatePassword(req.user.id, newPasswordHash);
            
            res.json({
                success: true,
                message: 'Password changed successfully'
            });
        } catch (error) {
            console.error('Change password error:', error);
            res.status(500).json({
                success: false,
                message: 'Error changing password',
                error: error.message
            });
        }
    }
    
    /**
     * Logout user
     * @route POST /api/auth/logout
     */
    static async logout(req, res) {
        try {
            // In a real application, you might want to blacklist the token
            // For now, we'll just return a success message
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Error logging out',
                error: error.message
            });
        }
    }
}

module.exports = AuthController;
