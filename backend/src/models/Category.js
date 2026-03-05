const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Category {
    /**
     * Create a new category
     * @param {Object} categoryData - Category data
     * @returns {Object} Created category
     */
    static async create(categoryData) {
        const {
            user_id,
            name,
            color = '#3B82F6',
            icon = null
        } = categoryData;
        
        const id = uuidv4();
        
        const query = `
            INSERT INTO categories (id, user_id, name, color, icon)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        await pool.execute(query, [id, user_id, name, color, icon]);
        
        return await this.findById(id);
    }
    
    /**
     * Find category by ID
     * @param {String} id - Category ID
     * @returns {Object|null} Category object
     */
    static async findById(id) {
        const query = 'SELECT * FROM categories WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        
        return rows.length > 0 ? rows[0] : null;
    }
    
    /**
     * Get all categories for a user
     * @param {String} userId - User ID
     * @returns {Array} Array of categories
     */
    static async findByUser(userId) {
        const query = `
            SELECT * FROM categories 
            WHERE user_id = ?
            ORDER BY name ASC
        `;
        
        const [rows] = await pool.execute(query, [userId]);
        
        return rows;
    }
    
    /**
     * Update category
     * @param {String} id - Category ID
     * @param {Object} categoryData - Category data to update
     * @returns {Object} Updated category
     */
    static async update(id, categoryData) {
        const allowedFields = ['name', 'color', 'icon'];
        const updates = [];
        const values = [];
        
        for (const [key, value] of Object.entries(categoryData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (updates.length === 0) {
            return await this.findById(id);
        }
        
        values.push(id);
        const query = `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`;
        
        await pool.execute(query, values);
        
        return await this.findById(id);
    }
    
    /**
     * Delete category
     * @param {String} id - Category ID
     */
    static async delete(id) {
        const query = 'DELETE FROM categories WHERE id = ?';
        await pool.execute(query, [id]);
    }
    
    /**
     * Check if category name exists for user
     * @param {String} userId - User ID
     * @param {String} name - Category name
     * @returns {Boolean} True if exists
     */
    static async nameExists(userId, name) {
        const query = 'SELECT id FROM categories WHERE user_id = ? AND name = ?';
        const [rows] = await pool.execute(query, [userId, name]);
        
        return rows.length > 0;
    }
}

module.exports = Category;
