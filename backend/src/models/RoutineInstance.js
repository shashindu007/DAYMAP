const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const routineInstanceItemSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, default: uuidv4 },
        template_item_id: { type: String, default: null },
        title: { type: String, required: true, maxlength: 255, trim: true },
        notes: { type: String, default: null },
        duration_minutes: { type: Number, default: null },
        start_time: { type: String, default: null },
        end_time: { type: String, default: null },
        order: { type: Number, required: true },
        status: { type: String, enum: ['pending', 'in_progress', 'completed', 'skipped'], default: 'pending' },
        scheduled_task_id: { type: String, default: null },
        completed_at: { type: Date, default: null }
    },
    { _id: false }
);

const routineInstanceSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        template_id: { type: String, required: true, ref: 'RoutineTemplate' },
        date: { type: String, required: true },
        name: { type: String, required: true, maxlength: 100, trim: true },
        description: { type: String, default: null },
        color: { type: String, default: '#6366F1' },
        icon: { type: String, default: null },
        is_active: { type: Boolean, default: true },
        items: { type: [routineInstanceItemSchema], default: [] }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false
    }
);

routineInstanceSchema.index({ user_id: 1, date: 1 });
routineInstanceSchema.index({ user_id: 1, template_id: 1, date: 1 }, { unique: true });

const RoutineInstanceDocument = mongoose.models.RoutineInstance || mongoose.model('RoutineInstance', routineInstanceSchema);

class RoutineInstance {
    static async create(payload) {
        const created = await RoutineInstanceDocument.create({
            id: uuidv4(),
            ...payload
        });
        return created?.toObject ? created.toObject() : created;
    }

    static async findById(id) {
        return RoutineInstanceDocument.findOne({ id }).lean();
    }

    static async findByUserAndDate(userId, date) {
        return RoutineInstanceDocument.find({ user_id: userId, date }).sort({ created_at: -1 }).lean();
    }

    static async findByTemplateAndDate(userId, templateId, date) {
        return RoutineInstanceDocument.findOne({ user_id: userId, template_id: templateId, date }).lean();
    }

    static async update(id, updates) {
        await RoutineInstanceDocument.updateOne({ id }, { $set: updates });
        return RoutineInstanceDocument.findOne({ id }).lean();
    }

    static async updateItem(instanceId, itemId, updates) {
        const setFields = {};
        Object.entries(updates).forEach(([key, value]) => {
            setFields[`items.$.${key}`] = value;
        });

        await RoutineInstanceDocument.updateOne(
            { id: instanceId, 'items.id': itemId },
            { $set: setFields }
        );

        return RoutineInstanceDocument.findOne({ id: instanceId }).lean();
    }

    static async deleteByTemplate(templateId) {
        await RoutineInstanceDocument.deleteMany({ template_id: templateId });
    }
}

module.exports = RoutineInstance;
