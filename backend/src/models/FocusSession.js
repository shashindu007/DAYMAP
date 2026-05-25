const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const focusSessionSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        schedule_task_id: { type: String, default: null },
        task_id: { type: String, default: null },
        status: { type: String, enum: ['completed', 'partial'], default: 'completed' },
        date: { type: String, required: true },
        start_time: { type: String, required: true },
        end_time: { type: String, default: null },
        target_minutes: { type: Number, default: null },
        actual_minutes: { type: Number, default: null },
        duration_minutes: { type: Number, required: true },
        category: { type: String, default: '' },
        tags: { type: [String], default: [] },
        started_at: { type: Date, default: null },
        ended_at: { type: Date, default: null }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: false },
        versionKey: false
    }
);

focusSessionSchema.index({ user_id: 1, date: 1 });

const FocusSessionDocument = mongoose.models.FocusSession || mongoose.model('FocusSession', focusSessionSchema);

class FocusSession {
    /**
     * Create a focus session
     * @param {String} userId
     * @param {Object} payload
     * @returns {Object}
     */
    static async createSession(userId, payload) {
        const {
            schedule_task_id = null,
            task_id = null,
            status = 'completed',
            date,
            start_time,
            end_time = null,
            target_minutes = null,
            actual_minutes = null,
            duration_minutes,
            category = '',
            tags = [],
            started_at = null,
            ended_at = null
        } = payload;

        const document = await FocusSessionDocument.create({
            id: uuidv4(),
            user_id: userId,
            schedule_task_id,
            task_id,
            status,
            date,
            start_time,
            end_time,
            target_minutes,
            actual_minutes,
            duration_minutes,
            category,
            tags,
            started_at,
            ended_at
        });

        return document.toObject();
    }

    /**
     * Get focus sessions by date range
     * @param {String} userId
     * @param {String} startDate
     * @param {String} endDate
     * @param {Number} limit
     * @returns {Array}
     */
    static async getByRange(userId, startDate, endDate, limit = 200) {
        return await FocusSessionDocument.find({
            user_id: userId,
            date: { $gte: startDate, $lte: endDate }
        })
            .sort({ date: 1, start_time: 1 })
            .limit(limit)
            .lean();
    }
}

module.exports = FocusSession;
