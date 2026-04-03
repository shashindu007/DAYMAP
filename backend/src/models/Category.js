const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// NOTE: Major migration change - SQL table -> Mongoose schema.
const categorySchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        name: { type: String, required: true, maxlength: 100, trim: true },
        color: { type: String, default: '#3B82F6' },
        icon: { type: String, default: null, maxlength: 50 }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: false },
        versionKey: false
    }
);

categorySchema.index({ user_id: 1, name: 1 }, { unique: true });
categorySchema.index({ user_id: 1 });

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
            icon = null
        } = categoryData;

        const created = await CategoryDocument.create({ id: uuidv4(), user_id, name, color, icon });
        return await this.findById(created.id);
    }
    
    /**
     * Find category by ID
     * @param {String} id - Category ID
     * @returns {Object|null} Category object
     */
    static async findById(id) {
        return await CategoryDocument.findOne({ id }).lean();
    }
    
    /**
     * Get all categories for a user
     * @param {String} userId - User ID
     * @returns {Array} Array of categories
     */
    static async findByUser(userId) {
        return await CategoryDocument.find({ user_id: userId }).sort({ name: 1 }).lean();
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
     * Check if category name exists for user
     * @param {String} userId - User ID
     * @param {String} name - Category name
     * @returns {Boolean} True if exists
     */
    static async nameExists(userId, name) {
        const count = await CategoryDocument.countDocuments({ user_id: userId, name });
        return count > 0;
    }
}

module.exports = Category;
