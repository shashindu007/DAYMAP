const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Task {
    /**
     * Create a new task
     * @param {Object} taskData - Task data
     * @returns {Object} Created task
     */
    static async create(taskData) {
        const {
            user_id,
            title,
            description = null,
            category = null,
            priority = 'medium',
            status = 'pending',
            scheduled_date = null,
            scheduled_time = null,
            duration_minutes = null,
            is_recurring = false,
            recurrence_pattern = null,
            parent_task_id = null
        } = taskData;
        
        const id = uuidv4();
        
        const query = `
            INSERT INTO tasks (
                id, user_id, title, description, category, priority, status,
                scheduled_date, scheduled_time, duration_minutes, is_recurring,
                recurrence_pattern, parent_task_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            id, user_id, title, description, category, priority, status,
            scheduled_date, scheduled_time, duration_minutes, is_recurring,
            recurrence_pattern ? JSON.stringify(recurrence_pattern) : null,
            parent_task_id
        ];
        
        await pool.execute(query, values);
        
        return await this.findById(id);
    }
    
    /**
     * Find task by ID
     * @param {String} id - Task ID
     * @returns {Object|null} Task object
     */
    static async findById(id) {
        const query = 'SELECT * FROM tasks WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        
        if (rows.length === 0) return null;
        
        const task = rows[0];
        if (task.recurrence_pattern) {
            task.recurrence_pattern = JSON.parse(task.recurrence_pattern);
        }
        
        return task;
    }
    
    /**
     * Get all tasks for a user with optional filters
     * @param {String} userId - User ID
     * @param {Object} filters - Optional filters
     * @returns {Array} Array of tasks
     */
    static async findByUser(userId, filters = {}) {
        let query = 'SELECT * FROM tasks WHERE user_id = ?';
        const values = [userId];
        
        if (filters.status) {
            query += ' AND status = ?';
            values.push(filters.status);
        }
        
        if (filters.priority) {
            query += ' AND priority = ?';
            values.push(filters.priority);
        }
        
        if (filters.category) {
            query += ' AND category = ?';
            values.push(filters.category);
        }
        
        if (filters.scheduled_date) {
            query += ' AND scheduled_date = ?';
            values.push(filters.scheduled_date);
        }
        
        if (filters.date_from && filters.date_to) {
            query += ' AND scheduled_date BETWEEN ? AND ?';
            values.push(filters.date_from, filters.date_to);
        }
        
        query += ' ORDER BY scheduled_date ASC, scheduled_time ASC';
        
        const [rows] = await pool.execute(query, values);
        
        return rows.map(task => {
            if (task.recurrence_pattern) {
                task.recurrence_pattern = JSON.parse(task.recurrence_pattern);
            }
            return task;
        });
    }
    
    /**
     * Get tasks for today
     * @param {String} userId - User ID
     * @param {String} date - Date in YYYY-MM-DD format
     * @returns {Array} Array of tasks
     */
    static async findByDate(userId, date) {
        const query = `
            SELECT * FROM tasks 
            WHERE user_id = ? AND scheduled_date = ?
            ORDER BY scheduled_time ASC
        `;
        
        const [rows] = await pool.execute(query, [userId, date]);
        
        return rows.map(task => {
            if (task.recurrence_pattern) {
                task.recurrence_pattern = JSON.parse(task.recurrence_pattern);
            }
            return task;
        });
    }
    
    /**
     * Get tasks for a week
     * @param {String} userId - User ID
     * @param {String} startDate - Start date
     * @param {String} endDate - End date
     * @returns {Array} Array of tasks
     */
    static async findByWeek(userId, startDate, endDate) {
        const query = `
            SELECT * FROM tasks 
            WHERE user_id = ? AND scheduled_date BETWEEN ? AND ?
            ORDER BY scheduled_date ASC, scheduled_time ASC
        `;
        
        const [rows] = await pool.execute(query, [userId, startDate, endDate]);
        
        return rows.map(task => {
            if (task.recurrence_pattern) {
                task.recurrence_pattern = JSON.parse(task.recurrence_pattern);
            }
            return task;
        });
    }
    
    /**
     * Update task
     * @param {String} id - Task ID
     * @param {Object} taskData - Task data to update
     * @returns {Object} Updated task
     */
    static async update(id, taskData) {
        const allowedFields = [
            'title', 'description', 'category', 'priority', 'status',
            'scheduled_date', 'scheduled_time', 'duration_minutes',
            'actual_duration_minutes', 'is_recurring', 'recurrence_pattern'
        ];
        
        const updates = [];
        const values = [];
        
        for (const [key, value] of Object.entries(taskData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                if (key === 'recurrence_pattern' && value !== null) {
                    values.push(JSON.stringify(value));
                } else {
                    values.push(value);
                }
            }
        }
        
        if (updates.length === 0) {
            return await this.findById(id);
        }
        
        values.push(id);
        const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
        
        await pool.execute(query, values);
        
        return await this.findById(id);
    }
    
    /**
     * Update task status
     * @param {String} id - Task ID
     * @param {String} status - New status
     * @returns {Object} Updated task
     */
    static async updateStatus(id, status) {
        let query = 'UPDATE tasks SET status = ?';
        const values = [status, id];
        
        if (status === 'completed') {
            query += ', completed_at = CURRENT_TIMESTAMP WHERE id = ?';
        } else {
            query += ', completed_at = NULL WHERE id = ?';
        }
        
        await pool.execute(query, values);
        
        return await this.findById(id);
    }
    
    /**
     * Delete task
     * @param {String} id - Task ID
     */
    static async delete(id) {
        const query = 'DELETE FROM tasks WHERE id = ?';
        await pool.execute(query, [id]);
    }
    
    /**
     * Delete multiple tasks
     * @param {Array} ids - Array of task IDs
     */
    static async bulkDelete(ids) {
        if (ids.length === 0) return;
        
        const placeholders = ids.map(() => '?').join(',');
        const query = `DELETE FROM tasks WHERE id IN (${placeholders})`;
        
        await pool.execute(query, ids);
    }
    
    /**
     * Get task statistics for a user
     * @param {String} userId - User ID
     * @param {String} date - Date
     * @returns {Object} Statistics
     */
    static async getStatsByDate(userId, date) {
        const query = `
            SELECT 
                COUNT(*) as total_tasks,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                SUM(duration_minutes) as total_scheduled_minutes,
                SUM(CASE WHEN status = 'completed' THEN actual_duration_minutes ELSE 0 END) as total_actual_minutes
            FROM tasks
            WHERE user_id = ? AND scheduled_date = ?
        `;
        
        const [rows] = await pool.execute(query, [userId, date]);
        
        return rows[0];
    }
}

module.exports = Task;
