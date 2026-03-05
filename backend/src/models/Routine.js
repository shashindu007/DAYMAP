const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Routine {
    /**
     * Create a new routine
     * @param {Object} routineData - Routine data
     * @returns {Object} Created routine
     */
    static async create(routineData) {
        const {
            user_id,
            name,
            description = null,
            routine_type = 'custom',
            is_active = true
        } = routineData;
        
        const id = uuidv4();
        
        const query = `
            INSERT INTO routines (id, user_id, name, description, routine_type, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        await pool.execute(query, [id, user_id, name, description, routine_type, is_active]);
        
        return await this.findById(id);
    }
    
    /**
     * Find routine by ID
     * @param {String} id - Routine ID
     * @returns {Object|null} Routine object
     */
    static async findById(id) {
        const query = 'SELECT * FROM routines WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        
        return rows.length > 0 ? rows[0] : null;
    }
    
    /**
     * Get all routines for a user
     * @param {String} userId - User ID
     * @param {Boolean} activeOnly - Get only active routines
     * @returns {Array} Array of routines
     */
    static async findByUser(userId, activeOnly = false) {
        let query = 'SELECT * FROM routines WHERE user_id = ?';
        
        if (activeOnly) {
            query += ' AND is_active = 1';
        }
        
        query += ' ORDER BY created_at DESC';
        
        const [rows] = await pool.execute(query, [userId]);
        
        return rows;
    }
    
    /**
     * Update routine
     * @param {String} id - Routine ID
     * @param {Object} routineData - Routine data to update
     * @returns {Object} Updated routine
     */
    static async update(id, routineData) {
        const allowedFields = ['name', 'description', 'routine_type', 'is_active'];
        const updates = [];
        const values = [];
        
        for (const [key, value] of Object.entries(routineData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }
        
        if (updates.length === 0) {
            return await this.findById(id);
        }
        
        values.push(id);
        const query = `UPDATE routines SET ${updates.join(', ')} WHERE id = ?`;
        
        await pool.execute(query, values);
        
        return await this.findById(id);
    }
    
    /**
     * Toggle routine active status
     * @param {String} id - Routine ID
     * @returns {Object} Updated routine
     */
    static async toggleActive(id) {
        const query = 'UPDATE routines SET is_active = NOT is_active WHERE id = ?';
        await pool.execute(query, [id]);
        
        return await this.findById(id);
    }
    
    /**
     * Delete routine
     * @param {String} id - Routine ID
     */
    static async delete(id) {
        const query = 'DELETE FROM routines WHERE id = ?';
        await pool.execute(query, [id]);
    }
}

module.exports = Routine;
