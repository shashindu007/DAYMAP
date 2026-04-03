const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// NOTE: Major migration change - SQL table -> Mongoose schema.
const routineTaskSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        routine_id: { type: String, required: true, ref: 'Routine' },
        task_template: { type: mongoose.Schema.Types.Mixed, required: true },
        task_order: { type: Number, required: true }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: false },
        versionKey: false
    }
);

routineTaskSchema.index({ routine_id: 1, task_order: 1 });

const RoutineTaskDocument = mongoose.models.RoutineTask || mongoose.model('RoutineTask', routineTaskSchema);

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

        const created = await RoutineTaskDocument.create({
            id: uuidv4(),
            routine_id,
            task_template,
            task_order
        });

        return await this.findById(created.id);
    }
    
    /**
     * Find routine task by ID
     * @param {String} id - Routine task ID
     * @returns {Object|null} Routine task object
     */
    static async findById(id) {
        return await RoutineTaskDocument.findOne({ id }).lean();
    }
    
    /**
     * Get all tasks for a routine
     * @param {String} routineId - Routine ID
     * @returns {Array} Array of routine tasks
     */
    static async findByRoutine(routineId) {
        return await RoutineTaskDocument.find({ routine_id: routineId }).sort({ task_order: 1 }).lean();
    }
    
    /**
     * Update routine task
     * @param {String} id - Routine task ID
     * @param {Object} routineTaskData - Routine task data to update
     * @returns {Object} Updated routine task
     */
    static async update(id, routineTaskData) {
        const allowedFields = ['task_template', 'task_order'];
        const updates = {};
        
        for (const [key, value] of Object.entries(routineTaskData)) {
            if (allowedFields.includes(key)) {
                updates[key] = value;
            }
        }
        
        if (Object.keys(updates).length === 0) {
            return await this.findById(id);
        }

        await RoutineTaskDocument.updateOne({ id }, { $set: updates });
        
        return await this.findById(id);
    }
    
    /**
     * Delete routine task
     * @param {String} id - Routine task ID
     */
    static async delete(id) {
        await RoutineTaskDocument.deleteOne({ id });
    }
    
    /**
     * Delete all tasks for a routine
     * @param {String} routineId - Routine ID
     */
    static async deleteByRoutine(routineId) {
        await RoutineTaskDocument.deleteMany({ routine_id: routineId });
    }
}

module.exports = RoutineTask;
