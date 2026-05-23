const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const scheduleSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        scheduled_date: { type: String, required: true }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false
    }
);

scheduleSchema.index({ user_id: 1, scheduled_date: 1 }, { unique: true });

const ScheduleDocument = mongoose.models.Schedule || mongoose.model('Schedule', scheduleSchema);

class Schedule {
    static async create(scheduleData) {
        const { user_id, scheduled_date } = scheduleData;

        const created = await ScheduleDocument.create({
            id: uuidv4(),
            user_id,
            scheduled_date
        });

        return created?.toObject ? created.toObject() : created;
    }

    static async findByUserAndDate(userId, date) {
        return ScheduleDocument.findOne({ user_id: userId, scheduled_date: date }).lean();
    }

    static async deleteByUserAndDate(userId, date) {
        await ScheduleDocument.deleteOne({ user_id: userId, scheduled_date: date });
    }
}

module.exports = Schedule;
