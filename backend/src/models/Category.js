const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// NOTE: Major migration change - SQL table -> Mongoose schema.
const categorySchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        name: { type: String, required: true, maxlength: 100, trim: true },
        color: { type: String, default: '#3B82F6' },
        icon: { type: String, default: null, maxlength: 50 },
        // Task categories and Wallet spend categories share this collection
        // rather than duplicating a near-identical model. Deliberately absent
        // from update()'s allowedFields: flipping a category between kinds
        // would orphan whichever side already references it.
        kind: { type: String, enum: ['task', 'spend'], default: 'task' }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: false },
        versionKey: false
    }
);

// Widened from { user_id, name } so "Food" can exist once per kind. The old
// index is dropped at boot by utils/ensureIndexes.js - editing this line does
// NOT remove an index Mongo has already built.
categorySchema.index({ user_id: 1, kind: 1, name: 1 }, { unique: true });
categorySchema.index({ user_id: 1 });

/**
 * Rows created before the wallet shipped have no `kind` field at all - schema
 * defaults fire on create, not on read. So `{ kind: 'task' }` would match none
 * of them; only `$ne: 'spend'` catches both the tagged and the legacy rows.
 */
const kindFilter = (kind) => (kind === 'spend' ? 'spend' : { $ne: 'spend' });

const withKind = (row) => (row ? { ...row, kind: row.kind || 'task' } : row);

const CategoryDocument = mongoose.models.Category || mongoose.model('Category', categorySchema);

class Category {
    /**
     * Create a new category
     * @param {Object} categoryData - Category data
     * @returns {Object} Created category
     */
    static async create(categoryData) {
        const {
            user_id,
            name,
            color = '#3B82F6',
            icon = null,
            kind = 'task'
        } = categoryData;

        const created = await CategoryDocument.create({
            id: uuidv4(), user_id, name, color, icon,
            kind: kind === 'spend' ? 'spend' : 'task'
        });
        return await this.findById(created.id);
    }

    /**
     * Find category by ID
     * @param {String} id - Category ID
     * @returns {Object|null} Category object
     */
    static async findById(id) {
        return withKind(await CategoryDocument.findOne({ id }).lean());
    }

    /**
     * Get all categories for a user
     * @param {String} userId - User ID
     * @param {String|null} kind - 'task' | 'spend', or null for every kind
     * @returns {Array} Array of categories
     */
    static async findByUser(userId, kind = null) {
        const filter = { user_id: userId };
        // No kind argument returns everything, exactly as before this field
        // existed - the only shape any current caller relies on.
        if (kind === 'spend' || kind === 'task') filter.kind = kindFilter(kind);
        const rows = await CategoryDocument.find(filter).sort({ name: 1 }).lean();
        return rows.map(withKind);
    }
    
    /**
     * Update category
     * @param {String} id - Category ID
     * @param {Object} categoryData - Category data to update
     * @returns {Object} Updated category
     */
    static async update(id, categoryData) {
        const allowedFields = ['name', 'color', 'icon'];
        const updates = {};
        
        for (const [key, value] of Object.entries(categoryData)) {
            if (allowedFields.includes(key)) {
                updates[key] = value;
            }
        }
        
        if (Object.keys(updates).length === 0) {
            return await this.findById(id);
        }

        await CategoryDocument.updateOne({ id }, { $set: updates });
        
        return await this.findById(id);
    }
    
    /**
     * Delete category
     * @param {String} id - Category ID
     */
    static async delete(id) {
        await CategoryDocument.deleteOne({ id });
    }
    
    /**
     * Check if category name exists for user, within one kind.
     * @param {String} userId - User ID
     * @param {String} name - Category name
     * @param {String} kind - 'task' | 'spend'
     * @returns {Boolean} True if exists
     */
    static async nameExists(userId, name, kind = 'task') {
        const count = await CategoryDocument.countDocuments({
            user_id: userId,
            name,
            kind: kindFilter(kind)
        });
        return count > 0;
    }
}

module.exports = Category;
