const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const scheduleTaskSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        schedule_id: { type: String, required: true, ref: 'Schedule' },
        user_id: { type: String, required: true, ref: 'User' },
        scheduled_date: { type: String, required: true },
        slot_start_time: { type: String, required: true },
        slot_end_time: { type: String, required: true },
        title: { type: String, required: true, maxlength: 255, trim: true },
        description: { type: String, default: null },
        category: { type: String, default: null, maxlength: 50 },
        priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
        status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
        duration_minutes: { type: Number, default: 30 },
        actual_duration_minutes: { type: Number, default: null },
        routine_template_id: { type: String, default: null },
        routine_instance_id: { type: String, default: null },
        routine_item_id: { type: String, default: null },
        source: { type: String, enum: ['task', 'routine', 'schedule'], default: 'schedule' }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false
    }
);

scheduleTaskSchema.index({ user_id: 1, scheduled_date: 1, slot_start_time: 1 }, { unique: true });
scheduleTaskSchema.index({ schedule_id: 1, slot_start_time: 1 });
scheduleTaskSchema.index({ status: 1 });
scheduleTaskSchema.index({ routine_instance_id: 1 });

const ScheduleTaskDocument = mongoose.models.ScheduleTask || mongoose.model('ScheduleTask', scheduleTaskSchema);

class ScheduleTask {
    static async createMany(tasks) {
        if (!tasks.length) return [];
        const created = await ScheduleTaskDocument.insertMany(tasks, { ordered: false });
        return created.map((doc) => (doc?.toObject ? doc.toObject() : doc));
    }

    static async findByDate(userId, date) {
        return ScheduleTaskDocument.find({ user_id: userId, scheduled_date: date })
            .sort({ slot_start_time: 1 })
            .lean();
    }

    static async getStatsByDate(userId, date) {
        const rows = await ScheduleTaskDocument.aggregate([
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

    static async findByDateRange(userId, startDate, endDate) {
        return ScheduleTaskDocument.find({
            user_id: userId,
            scheduled_date: { $gte: startDate, $lte: endDate }
        })
            .sort({ scheduled_date: 1, slot_start_time: 1 })
            .lean();
    }

    static async findById(id) {
        return ScheduleTaskDocument.findOne({ id }).lean();
    }

    static async update(id, updates) {
        const allowedFields = [
            'title',
            'description',
            'category',
            'priority',
            'status',
            'actual_duration_minutes',
            'slot_start_time',
            'slot_end_time',
            'duration_minutes'
        ];

        const safeUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                safeUpdates[key] = value;
            }
        }

        if (!Object.keys(safeUpdates).length) {
            return this.findById(id);
        }

        await ScheduleTaskDocument.updateOne({ id }, { $set: safeUpdates });
        return this.findById(id);
    }

    static async updateStatus(id, status) {
        await ScheduleTaskDocument.updateOne({ id }, { $set: { status } });
        return this.findById(id);
    }

    static async deleteById(id) {
        await ScheduleTaskDocument.deleteOne({ id });
    }

    static async deleteByScheduleId(scheduleId) {
        await ScheduleTaskDocument.deleteMany({ schedule_id: scheduleId });
    }

    static async deleteByUserAndDate(userId, date) {
        await ScheduleTaskDocument.deleteMany({ user_id: userId, scheduled_date: date });
    }
}

module.exports = ScheduleTask;
