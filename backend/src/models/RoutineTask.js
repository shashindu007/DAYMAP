const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class RoutineTask {
    /**
     * Create a new routine task
     * @param {Object} routineTaskData - Routine task data
     * @returns {Object} Created routine task
     */
    static async create(routineTaskData) {
        const {
            routine_id,
            task_template,
            task_order
        } = routineTaskData;
        
        const id = uuidv4();
        
        const query = `
            INSERT INTO routine_tasks (id, routine_id, task_template, task_order)
            VALUES (?, ?, ?, ?)
        `;
        
        await pool.execute(query, [
            id,
            routine_id,
            JSON.stringify(task_template),
            task_order
        ]);
        
        return await this.findById(id);
    }
    
    /**
     * Find routine task by ID
     * @param {String} id - Routine task ID
     * @returns {Object|null} Routine task object
     */
    static async findById(id) {
        const query = 'SELECT * FROM routine_tasks WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        
        if (rows.length === 0) return null;
        
        const routineTask = rows[0];
        routineTask.task_template = JSON.parse(routineTask.task_template);
        
        return routineTask;
    }
    
    /**
     * Get all tasks for a routine
     * @param {String} routineId - Routine ID
     * @returns {Array} Array of routine tasks
     */
    static async findByRoutine(routineId) {
        const query = `
            SELECT * FROM routine_tasks 
            WHERE routine_id = ?
            ORDER BY task_order ASC
        `;
        
        const [rows] = await pool.execute(query, [routineId]);
        
        return rows.map(task => {
            task.task_template = JSON.parse(task.task_template);
            return task;
        });
    }
    
    /**
     * Update routine task
     * @param {String} id - Routine task ID
     * @param {Object} routineTaskData - Routine task data to update
     * @returns {Object} Updated routine task
     */
    static async update(id, routineTaskData) {
        const allowedFields = ['task_template', 'task_order'];
        const updates = [];
        const values = [];
        
        for (const [key, value] of Object.entries(routineTaskData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                if (key === 'task_template') {
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
        const query = `UPDATE routine_tasks SET ${updates.join(', ')} WHERE id = ?`;
        
        await pool.execute(query, values);
        
        return await this.findById(id);
    }
    
    /**
     * Delete routine task
     * @param {String} id - Routine task ID
     */
    static async delete(id) {
        const query = 'DELETE FROM routine_tasks WHERE id = ?';
        await pool.execute(query, [id]);
    }
    
    /**
     * Delete all tasks for a routine
     * @param {String} routineId - Routine ID
     */
    static async deleteByRoutine(routineId) {
        const query = 'DELETE FROM routine_tasks WHERE routine_id = ?';
        await pool.execute(query, [routineId]);
    }
}

module.exports = RoutineTask;
