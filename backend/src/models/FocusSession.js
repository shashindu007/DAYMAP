const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const focusSessionSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        date: { type: String, required: true },
        start_time: { type: String, required: true },
        end_time: { type: String, default: null },
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
            date,
            start_time,
            end_time = null,
            duration_minutes,
            category = '',
            tags = [],
            started_at = null,
            ended_at = null
        } = payload;

        const document = await FocusSessionDocument.create({
            id: uuidv4(),
            user_id: userId,
            date,
            start_time,
            end_time,
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
