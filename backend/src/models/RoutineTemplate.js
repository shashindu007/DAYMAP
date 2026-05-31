const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const routineItemSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, default: uuidv4 },
        title: { type: String, required: true, maxlength: 255, trim: true },
        notes: { type: String, default: null },
        duration_minutes: { type: Number, default: null },
        start_time: { type: String, default: null },
        end_time: { type: String, default: null },
        order: { type: Number, required: true },
        completion_tracking: { type: Boolean, default: true }
    },
    { _id: false }
);

const routineTemplateSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        name: { type: String, required: true, maxlength: 100, trim: true },
        description: { type: String, default: null },
        color: { type: String, default: '#6366F1' },
        icon: { type: String, default: null },
        is_active: { type: Boolean, default: true },
        created_by: { type: String, required: true },
        recurrence: {
            type: {
                type: String,
                enum: ['daily', 'weekdays', 'weekends', 'custom'],
                default: 'daily'
            },
            days_of_week: { type: [Number], default: null },
            start_date: { type: String, default: null },
            end_date: { type: String, default: null }
        },
        items: { type: [routineItemSchema], default: [] },
        legacy_routine_id: { type: String, default: null }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false
    }
);

routineTemplateSchema.index({ user_id: 1, is_active: 1 });
routineTemplateSchema.index({ user_id: 1, name: 1 });

const RoutineTemplateDocument = mongoose.models.RoutineTemplate || mongoose.model('RoutineTemplate', routineTemplateSchema);

class RoutineTemplate {
    static async create(payload) {
        const created = await RoutineTemplateDocument.create({
            id: uuidv4(),
            ...payload
        });
        return created?.toObject ? created.toObject() : created;
    }

    static async findById(id) {
        return RoutineTemplateDocument.findOne({ id }).lean();
    }

    static async findByUser(userId, activeOnly = false) {
        const filter = { user_id: userId };
        if (activeOnly) filter.is_active = true;
        return RoutineTemplateDocument.find(filter).sort({ created_at: -1 }).lean();
    }

    static async update(id, updates) {
        await RoutineTemplateDocument.updateOne({ id }, { $set: updates });
        return RoutineTemplateDocument.findOne({ id }).lean();
    }

    static async delete(id) {
        await RoutineTemplateDocument.deleteOne({ id });
    }
}

module.exports = RoutineTemplate;
