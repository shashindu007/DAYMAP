const { verifyToken } = require('../config/jwt');
const User = require('../models/User');

/**
 * Authenticate JWT token and attach user to request
 */
const authMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided. Authorization denied.'
            });
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        try {
            // Verify token
            const decoded = verifyToken(token);
            
            // Get user from database
            const user = await User.findById(decoded.id);
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found. Authorization denied.'
                });
            }
            
            // Attach user to request
            req.user = {
                id: user.id,
                email: user.email,
                name: user.name,
                timezone: user.timezone || 'UTC'
            };
            
            next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token. Authorization denied.'
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during authentication'
        });
    }
};

module.exports = authMiddleware;
