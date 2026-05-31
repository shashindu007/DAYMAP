const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const routineAnalyticsSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        date: { type: String, required: true },
        total_items: { type: Number, default: 0 },
        completed_items: { type: Number, default: 0 },
        skipped_items: { type: Number, default: 0 }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false
    }
);

routineAnalyticsSchema.index({ user_id: 1, date: 1 }, { unique: true });

const RoutineAnalyticsDocument = mongoose.models.RoutineAnalytics || mongoose.model('RoutineAnalytics', routineAnalyticsSchema);

class RoutineAnalytics {
    static async upsert(userId, date, payload) {
        const { total_items = 0, completed_items = 0, skipped_items = 0 } = payload;
        await RoutineAnalyticsDocument.updateOne(
            { user_id: userId, date },
            {
                $set: {
                    total_items,
                    completed_items,
                    skipped_items
                },
                $setOnInsert: {
                    id: uuidv4(),
                    user_id: userId,
                    date
                }
            },
            { upsert: true }
        );

        return RoutineAnalyticsDocument.findOne({ user_id: userId, date }).lean();
    }

    static async findByDate(userId, date) {
        return RoutineAnalyticsDocument.findOne({ user_id: userId, date }).lean();
    }

    static async findByRange(userId, startDate, endDate) {
        return RoutineAnalyticsDocument.find({
            user_id: userId,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 }).lean();
    }
}

module.exports = RoutineAnalytics;
