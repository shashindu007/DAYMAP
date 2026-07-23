const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { SCHEDULE_TASK_STATUSES } = require('../utils/statusMapping');

// NOTE: Major migration change - SQL table -> Mongoose schema.
const taskSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        title: { type: String, required: true, maxlength: 255, trim: true },
        description: { type: String, default: null },
        category: { type: String, default: null, maxlength: 50 },
        priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
        status: { type: String, enum: SCHEDULE_TASK_STATUSES, default: 'pending' },
        scheduled_date: { type: String, default: null }, // Kept as YYYY-MM-DD for API compatibility
        scheduled_time: { type: String, default: null }, // Kept as HH:MM:SS for API compatibility
        duration_minutes: { type: Number, default: null },
        actual_duration_minutes: { type: Number, default: null },
        is_recurring: { type: Boolean, default: false },
        recurrence_pattern: { type: mongoose.Schema.Types.Mixed, default: null },
        parent_task_id: { type: String, default: null },
        completed_at: { type: Date, default: null }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false
    }
);

taskSchema.index({ user_id: 1, scheduled_date: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ priority: 1 });

const TaskDocument = mongoose.models.Task || mongoose.model('Task', taskSchema);

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
            actual_duration_minutes = null,
            is_recurring = false,
            recurrence_pattern = null,
            parent_task_id = null
        } = taskData;

        const created = await TaskDocument.create({
            id: uuidv4(),
            user_id,
            title,
            description,
            category,
            priority,
            status,
            scheduled_date,
            scheduled_time,
            duration_minutes,
            actual_duration_minutes,
            is_recurring,
            recurrence_pattern,
            parent_task_id,
            // A task can be created already-finished (e.g. logged after an
            // ad-hoc focus session), so stamp completed_at up front.
            completed_at: status === 'completed' ? new Date() : null
        });

        return created?.toObject ? created.toObject() : created;
    }
    
    /**
     * Find task by ID
     * @param {String} id - Task ID
     * @returns {Object|null} Task object
     */
    static async findById(id) {
        return await TaskDocument.findOne({ id }).lean();
    }
    
    /**
     * Get all tasks for a user with optional filters
     * @param {String} userId - User ID
     * @param {Object} filters - Optional filters
     * @returns {Array} Array of tasks
     */
    static async findByUser(userId, filters = {}) {
        const mongoFilters = { user_id: userId };

        if (filters.status) mongoFilters.status = filters.status;
        if (filters.priority) mongoFilters.priority = filters.priority;
        if (filters.category) mongoFilters.category = filters.category;
        if (filters.scheduled_date) mongoFilters.scheduled_date = filters.scheduled_date;
        if (filters.date_from && filters.date_to) {
            mongoFilters.scheduled_date = { $gte: filters.date_from, $lte: filters.date_to };
        }

        return await TaskDocument.find(mongoFilters)
            .sort({ scheduled_date: 1, scheduled_time: 1 })
            .lean();
    }
    
    /**
     * Get tasks for today
     * @param {String} userId - User ID
     * @param {String} date - Date in YYYY-MM-DD format
     * @returns {Array} Array of tasks
     */
    static async findByDate(userId, date) {
        return await TaskDocument.find({ user_id: userId, scheduled_date: date })
            .sort({ scheduled_time: 1 })
            .lean();
    }
    
    /**
     * Get tasks for a week
     * @param {String} userId - User ID
     * @param {String} startDate - Start date
     * @param {String} endDate - End date
     * @returns {Array} Array of tasks
     */
    static async findByWeek(userId, startDate, endDate) {
        return await TaskDocument.find({
            user_id: userId,
            scheduled_date: { $gte: startDate, $lte: endDate }
        })
            .sort({ scheduled_date: 1, scheduled_time: 1 })
            .lean();
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

        const updates = {};
        
        for (const [key, value] of Object.entries(taskData)) {
            if (allowedFields.includes(key)) {
                updates[key] = value;
            }
        }
        
        if (Object.keys(updates).length === 0) {
            return await this.findById(id);
        }

        await TaskDocument.updateOne({ id }, { $set: updates });
        
        return await this.findById(id);
    }
    
    /**
     * Update task status
     * @param {String} id - Task ID
     * @param {String} status - New status
     * @returns {Object} Updated task
     */
    static async updateStatus(id, status) {
        await TaskDocument.updateOne(
            { id },
            {
                $set: {
                    status,
                    completed_at: status === 'completed' ? new Date() : null
                }
            }
        );

        return await this.findById(id);
    }
    
    /**
     * Delete task
     * @param {String} id - Task ID
     */
    static async delete(id) {
        await TaskDocument.deleteOne({ id });
    }
    
    /**
     * Delete multiple tasks
     * @param {Array} ids - Array of task IDs
     */
    static async bulkDelete(ids) {
        if (ids.length === 0) return;

        await TaskDocument.deleteMany({ id: { $in: ids } });
    }

    /**
     * Delete all tasks for a user on a specific date
     * @param {String} userId - User ID
     * @param {String} date - Date in YYYY-MM-DD
     */
    static async deleteByUserAndDate(userId, date) {
        await TaskDocument.deleteMany({ user_id: userId, scheduled_date: date });
    }
    
    /**
     * Get task statistics for a user
     * @param {String} userId - User ID
     * @param {String} date - Date
     * @returns {Object} Statistics
     */
    static async getStatsByDate(userId, date) {
        const rows = await TaskDocument.aggregate([
            {
                $match: {
                    user_id: userId,
                    scheduled_date: date
                }
            },
            {
                $group: {
                    _id: null,
                    total_tasks: { $sum: 1 },
                    completed_tasks: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
                        }
                    },
                    total_scheduled_minutes: { $sum: { $ifNull: ['$duration_minutes', 0] } },
                    total_actual_minutes: {
                        $sum: {
                            $cond: [
                                { $eq: ['$status', 'completed'] },
                                { $ifNull: ['$actual_duration_minutes', 0] },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        if (!rows.length) {
            return {
                total_tasks: 0,
                completed_tasks: 0,
                total_scheduled_minutes: 0,
                total_actual_minutes: 0
            };
        }

        return rows[0];
    }
}

module.exports = Task;
