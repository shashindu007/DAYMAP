const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class User {
    /**
     * Create a new user
     * @param {Object} userData - User data
     * @returns {Object} Created user
     */
    static async create(userData) {
        const { email, password_hash, name, timezone = 'UTC' } = userData;
        const id = uuidv4();
        
        const query = `
            INSERT INTO users (id, email, password_hash, name, timezone)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        await pool.execute(query, [id, email, password_hash, name, timezone]);
        
        return await this.findById(id);
    }
    
    /**
     * Find user by ID
     * @param {String} id - User ID
     * @returns {Object|null} User object
     */
    static async findById(id) {
        const query = 'SELECT * FROM users WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        
        if (rows.length === 0) return null;
        
        const user = rows[0];
        delete user.password_hash; // Don't return password hash
        return user;
    }
    
    /**
     * Find user by email
     * @param {String} email - User email
     * @returns {Object|null} User object
     */
    static async findByEmail(email) {
        const query = 'SELECT * FROM users WHERE email = ?';
        const [rows] = await pool.execute(query, [email]);
        
        return rows.length > 0 ? rows[0] : null;
    }
    
    /**
     * Find user by email (without password hash removed - for authentication)
     * @param {String} email - User email
     * @returns {Object|null} User object with password hash
     */
    static async findByEmailWithPassword(email) {
        const query = 'SELECT * FROM users WHERE email = ?';
        const [rows] = await pool.execute(query, [email]);
        
        return rows.length > 0 ? rows[0] : null;
    }
    
    /**
     * Update user
     * @param {String} id - User ID
     * @param {Object} userData - User data to update
     * @returns {Object} Updated user
     */
    static async update(id, userData) {
        const allowedFields = ['name', 'email', 'timezone'];
        const updates = [];
        const values = [];
        
        for (const [key, value] of Object.entries(userData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (updates.length === 0) {
            return await this.findById(id);
        }
        
        values.push(id);
        const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
        
        await pool.execute(query, values);
        
        return await this.findById(id);
    }
    
    /**
     * Update user password
     * @param {String} id - User ID
     * @param {String} password_hash - New password hash
     */
    static async updatePassword(id, password_hash) {
        const query = 'UPDATE users SET password_hash = ? WHERE id = ?';
        await pool.execute(query, [password_hash, id]);
    }
    
    /**
     * Delete user
     * @param {String} id - User ID
     */
    static async delete(id) {
        const query = 'DELETE FROM users WHERE id = ?';
        await pool.execute(query, [id]);
    }
    
    /**
     * Check if email exists
     * @param {String} email - Email to check
     * @returns {Boolean} True if exists
     */
    static async emailExists(email) {
        const query = 'SELECT id FROM users WHERE email = ?';
        const [rows] = await pool.execute(query, [email]);
        
        return rows.length > 0;
    }
}

module.exports = User;
