const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// NOTE: Major migration change - SQL table -> Mongoose schema.
const analyticsSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        date: { type: String, required: true }, // Kept as YYYY-MM-DD for API compatibility
        total_tasks_scheduled: { type: Number, default: 0 },
        total_tasks_completed: { type: Number, default: 0 },
        total_time_scheduled_minutes: { type: Number, default: 0 },
        total_time_spent_minutes: { type: Number, default: 0 },
        focus_time_spent_minutes: { type: Number, default: 0 },
        focus_sessions_count: { type: Number, default: 0 },
        focus_sessions_total: { type: Number, default: 0 },
        focus_sessions_completed: { type: Number, default: 0 }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: false },
        versionKey: false
    }
);

analyticsSchema.index({ user_id: 1, date: 1 }, { unique: true });

const AnalyticsDocument = mongoose.models.Analytics || mongoose.model('Analytics', analyticsSchema);

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
            total_time_spent_minutes = 0,
            focus_time_spent_minutes = 0,
            focus_sessions_count = 0,
            focus_sessions_total = 0,
            focus_sessions_completed = 0
        } = stats;
        
        await AnalyticsDocument.updateOne(
            { user_id: userId, date },
            {
                $set: {
                    total_tasks_scheduled,
                    total_tasks_completed,
                    total_time_scheduled_minutes,
                    total_time_spent_minutes,
                    focus_time_spent_minutes,
                    focus_sessions_count,
                    focus_sessions_total,
                    focus_sessions_completed
                },
                $setOnInsert: {
                    id: uuidv4(),
                    user_id: userId,
                    date
                }
            },
            { upsert: true }
        );
        
        return await this.findByDate(userId, date);
    }

    /**
     * Record one focus session on a specific date
     * @param {String} userId
     * @param {String} date
     * @param {Number} durationMinutes
     * @returns {Object}
     */
    static async recordFocusSession(userId, date, durationMinutes, status = 'completed') {
        const normalizedDuration = Math.max(1, parseInt(durationMinutes, 10) || 0);
        const isCompleted = status === 'completed';

        await AnalyticsDocument.updateOne(
            { user_id: userId, date },
            {
                $inc: {
                    focus_time_spent_minutes: normalizedDuration,
                    focus_sessions_count: 1,
                    focus_sessions_total: 1,
                    focus_sessions_completed: isCompleted ? 1 : 0
                },
                $setOnInsert: {
                    id: uuidv4(),
                    user_id: userId,
                    date,
                    total_tasks_scheduled: 0,
                    total_tasks_completed: 0,
                    total_time_scheduled_minutes: 0,
                    total_time_spent_minutes: 0,
                    focus_sessions_total: 0,
                    focus_sessions_completed: 0
                }
            },
            { upsert: true }
        );

        return await this.findByDate(userId, date);
    }

    /**
     * Get focus statistics by date range
     * @param {String} userId
     * @param {String} startDate
     * @param {String} endDate
     * @returns {Array}
     */
    static async getFocusByRange(userId, startDate, endDate) {
        return await AnalyticsDocument.find({
            user_id: userId,
            date: { $gte: startDate, $lte: endDate }
        })
            .sort({ date: 1 })
            .select({
                _id: 0,
                date: 1,
                focus_time_spent_minutes: 1,
                focus_sessions_count: 1,
                focus_sessions_total: 1,
                focus_sessions_completed: 1
            })
            .lean();
    }
    
    /**
     * Find analytics by date
     * @param {String} userId - User ID
     * @param {String} date - Date
     * @returns {Object|null} Analytics object
     */
    static async findByDate(userId, date) {
        return await AnalyticsDocument.findOne({ user_id: userId, date }).lean();
    }
    
    /**
     * Get weekly analytics
     * @param {String} userId - User ID
     * @param {String} startDate - Start date
     * @param {String} endDate - End date
     * @returns {Array} Array of analytics
     */
    static async findByWeek(userId, startDate, endDate) {
        return await AnalyticsDocument.find({
            user_id: userId,
            date: { $gte: startDate, $lte: endDate }
        })
            .sort({ date: 1 })
            .lean();
    }
    
    /**
     * Get monthly analytics
     * @param {String} userId - User ID
     * @param {Number} year - Year
     * @param {Number} month - Month
     * @returns {Array} Array of analytics
     */
    static async findByMonth(userId, year, month) {
        const monthString = `${month}`.padStart(2, '0');
        const start = `${year}-${monthString}-01`;
        const end = `${year}-${monthString}-31`;

        return await AnalyticsDocument.find({
            user_id: userId,
            date: { $gte: start, $lte: end }
        })
            .sort({ date: 1 })
            .lean();
    }
    
    /**
     * Get analytics summary
     * @param {String} userId - User ID
     * @returns {Object} Summary statistics
     */
    static async getSummary(userId) {
        const rows = await AnalyticsDocument.aggregate([
            { $match: { user_id: userId } },
            {
                $project: {
                    total_tasks_scheduled: 1,
                    total_tasks_completed: 1,
                    total_time_scheduled_minutes: 1,
                    total_time_spent_minutes: 1,
                    focus_time_spent_minutes: 1,
                    focus_sessions_count: 1,
                    focus_sessions_total: 1,
                    focus_sessions_completed: 1,
                    completion_rate: {
                        $cond: [
                            { $gt: ['$total_tasks_scheduled', 0] },
                            {
                                $multiply: [
                                    { $divide: ['$total_tasks_completed', '$total_tasks_scheduled'] },
                                    100
                                ]
                            },
                            0
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total_tasks_scheduled: { $sum: '$total_tasks_scheduled' },
                    total_tasks_completed: { $sum: '$total_tasks_completed' },
                    total_time_scheduled_minutes: { $sum: '$total_time_scheduled_minutes' },
                    total_time_spent_minutes: { $sum: '$total_time_spent_minutes' },
                    focus_time_spent_minutes: { $sum: '$focus_time_spent_minutes' },
                    focus_sessions_count: { $sum: '$focus_sessions_count' },
                    focus_sessions_total: { $sum: '$focus_sessions_total' },
                    focus_sessions_completed: { $sum: '$focus_sessions_completed' },
                    avg_completion_rate: { $avg: '$completion_rate' }
                }
            }
        ]);

        if (!rows.length) {
            return {
                total_tasks_scheduled: 0,
                total_tasks_completed: 0,
                total_time_scheduled_minutes: 0,
                total_time_spent_minutes: 0,
                focus_time_spent_minutes: 0,
                focus_sessions_count: 0,
                focus_sessions_total: 0,
                focus_sessions_completed: 0,
                avg_completion_rate: 0
            };
        }

        return rows[0];
    }
}

module.exports = Analytics;
