const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// NOTE: Major migration change - SQL table -> Mongoose schema.
const routineSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        name: { type: String, required: true, maxlength: 100, trim: true },
        description: { type: String, default: null },
        routine_type: { type: String, enum: ['morning', 'afternoon', 'evening', 'custom'], default: 'custom' },
        is_active: { type: Boolean, default: true }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: false },
        versionKey: false
    }
);

routineSchema.index({ user_id: 1, is_active: 1 });

const RoutineDocument = mongoose.models.Routine || mongoose.model('Routine', routineSchema);

class Routine {
    /**
     * Create a new routine
     * @param {Object} routineData - Routine data
     * @returns {Object} Created routine
     */
    static async create(routineData) {
        const {
            user_id,
            name,
            description = null,
            routine_type = 'custom',
            is_active = true
        } = routineData;

        const created = await RoutineDocument.create({
            id: uuidv4(),
            user_id,
            name,
            description,
            routine_type,
            is_active
        });

        return await this.findById(created.id);
    }
    
    /**
     * Find routine by ID
     * @param {String} id - Routine ID
     * @returns {Object|null} Routine object
     */
    static async findById(id) {
        return await RoutineDocument.findOne({ id }).lean();
    }
    
    /**
     * Get all routines for a user
     * @param {String} userId - User ID
     * @param {Boolean} activeOnly - Get only active routines
     * @returns {Array} Array of routines
     */
    static async findByUser(userId, activeOnly = false) {
        const filter = { user_id: userId };
        if (activeOnly) filter.is_active = true;
        return await RoutineDocument.find(filter).sort({ created_at: -1 }).lean();
    }
    
    /**
     * Update routine
     * @param {String} id - Routine ID
     * @param {Object} routineData - Routine data to update
     * @returns {Object} Updated routine
     */
    static async update(id, routineData) {
        const allowedFields = ['name', 'description', 'routine_type', 'is_active'];
        const updates = {};
        
        for (const [key, value] of Object.entries(routineData)) {
            if (allowedFields.includes(key)) {
                updates[key] = value;
            }
        }
        
        if (Object.keys(updates).length === 0) {
            return await this.findById(id);
        }

        await RoutineDocument.updateOne({ id }, { $set: updates });
        
        return await this.findById(id);
    }
    
    /**
     * Toggle routine active status
     * @param {String} id - Routine ID
     * @returns {Object} Updated routine
     */
    static async toggleActive(id) {
        const routine = await RoutineDocument.findOne({ id });
        if (!routine) return null;
        routine.is_active = !routine.is_active;
        await routine.save();
        return await this.findById(id);
    }
    
    /**
     * Delete routine
     * @param {String} id - Routine ID
     */
    static async delete(id) {
        await RoutineDocument.deleteOne({ id });
    }
}

module.exports = Routine;
