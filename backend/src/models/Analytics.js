const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Analytics {
    /**
     * Create or update analytics for a date
     * @param {String} userId - User ID
     * @param {String} date - Date
     * @param {Object} stats - Analytics stats
     * @returns {Object} Analytics object
     */
    static async upsert(userId, date, stats) {
        const {
            total_tasks_scheduled = 0,
            total_tasks_completed = 0,
            total_time_scheduled_minutes = 0,
            total_time_spent_minutes = 0
        } = stats;
        
        const id = uuidv4();
        
        const query = `
            INSERT INTO analytics (
                id, user_id, date, total_tasks_scheduled, total_tasks_completed,
                total_time_scheduled_minutes, total_time_spent_minutes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                total_tasks_scheduled = VALUES(total_tasks_scheduled),
                total_tasks_completed = VALUES(total_tasks_completed),
                total_time_scheduled_minutes = VALUES(total_time_scheduled_minutes),
                total_time_spent_minutes = VALUES(total_time_spent_minutes)
        `;
        
        await pool.execute(query, [
            id, userId, date, total_tasks_scheduled, total_tasks_completed,
            total_time_scheduled_minutes, total_time_spent_minutes
        ]);
        
        return await this.findByDate(userId, date);
    }
    
    /**
     * Find analytics by date
     * @param {String} userId - User ID
     * @param {String} date - Date
     * @returns {Object|null} Analytics object
     */
    static async findByDate(userId, date) {
        const query = 'SELECT * FROM analytics WHERE user_id = ? AND date = ?';
        const [rows] = await pool.execute(query, [userId, date]);
        
        return rows.length > 0 ? rows[0] : null;
    }
    
    /**
     * Get weekly analytics
     * @param {String} userId - User ID
     * @param {String} startDate - Start date
     * @param {String} endDate - End date
     * @returns {Array} Array of analytics
     */
    static async findByWeek(userId, startDate, endDate) {
        const query = `
            SELECT * FROM analytics 
            WHERE user_id = ? AND date BETWEEN ? AND ?
            ORDER BY date ASC
        `;
        
        const [rows] = await pool.execute(query, [userId, startDate, endDate]);
        
        return rows;
    }
    
    /**
     * Get monthly analytics
     * @param {String} userId - User ID
     * @param {Number} year - Year
     * @param {Number} month - Month
     * @returns {Array} Array of analytics
     */
    static async findByMonth(userId, year, month) {
        const query = `
            SELECT * FROM analytics 
            WHERE user_id = ? AND YEAR(date) = ? AND MONTH(date) = ?
            ORDER BY date ASC
        `;
        
        const [rows] = await pool.execute(query, [userId, year, month]);
        
        return rows;
    }
    
    /**
     * Get analytics summary
     * @param {String} userId - User ID
     * @returns {Object} Summary statistics
     */
    static async getSummary(userId) {
        const query = `
            SELECT 
                SUM(total_tasks_scheduled) as total_tasks_scheduled,
                SUM(total_tasks_completed) as total_tasks_completed,
                SUM(total_time_scheduled_minutes) as total_time_scheduled_minutes,
                SUM(total_time_spent_minutes) as total_time_spent_minutes,
                AVG(total_tasks_completed / NULLIF(total_tasks_scheduled, 0) * 100) as avg_completion_rate
            FROM analytics
            WHERE user_id = ?
        `;
        
        const [rows] = await pool.execute(query, [userId]);
        
        return rows[0];
    }
}

module.exports = Analytics;
