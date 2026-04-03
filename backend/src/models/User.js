const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// NOTE: Major migration change - SQL table -> Mongoose schema.
const userSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        email: { type: String, required: true, unique: true, trim: true, lowercase: true },
        password_hash: { type: String, required: true },
        name: { type: String, required: true, minlength: 2, maxlength: 100, trim: true },
        timezone: { type: String, default: 'UTC', maxlength: 50 }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false
    }
);

userSchema.index({ email: 1 }, { unique: true });

const UserDocument = mongoose.models.User || mongoose.model('User', userSchema);

const toPlain = (doc) => (doc ? doc.toObject ? doc.toObject() : doc : null);

class User {
    /**
     * Create a new user
     * @param {Object} userData - User data
     * @returns {Object} Created user
     */
    static async create(userData) {
        const { email, password_hash, name, timezone = 'UTC' } = userData;
        const created = await UserDocument.create({
            id: uuidv4(),
            email,
            password_hash,
            name,
            timezone
        });

        return await this.findById(created.id);
    }
    
    /**
     * Find user by ID
     * @param {String} id - User ID
     * @returns {Object|null} User object
     */
    static async findById(id) {
        const user = toPlain(await UserDocument.findOne({ id }).lean());
        if (!user) return null;
        delete user.password_hash; // Don't return password hash
        return user;
    }
    
    /**
     * Find user by email
     * @param {String} email - User email
     * @returns {Object|null} User object
     */
    static async findByEmail(email) {
        const user = toPlain(await UserDocument.findOne({ email: email.toLowerCase() }).lean());
        return user;
    }
    
    /**
     * Find user by email (without password hash removed - for authentication)
     * @param {String} email - User email
     * @returns {Object|null} User object with password hash
     */
    static async findByEmailWithPassword(email) {
        const user = toPlain(await UserDocument.findOne({ email: email.toLowerCase() }).lean());
        return user;
    }
    
    /**
     * Update user
     * @param {String} id - User ID
     * @param {Object} userData - User data to update
     * @returns {Object} Updated user
     */
    static async update(id, userData) {
        const allowedFields = ['name', 'email', 'timezone'];
        const updates = {};
        
        for (const [key, value] of Object.entries(userData)) {
            if (allowedFields.includes(key)) {
                updates[key] = key === 'email' && typeof value === 'string' ? value.toLowerCase() : value;
            }
        }
        
        if (Object.keys(updates).length === 0) {
            return await this.findById(id);
        }

        await UserDocument.updateOne({ id }, { $set: updates });
        
        return await this.findById(id);
    }
    
    /**
     * Update user password
     * @param {String} id - User ID
     * @param {String} password_hash - New password hash
     */
    static async updatePassword(id, password_hash) {
        await UserDocument.updateOne({ id }, { $set: { password_hash } });
    }
    
    /**
     * Delete user
     * @param {String} id - User ID
     */
    static async delete(id) {
        await UserDocument.deleteOne({ id });
    }
    
    /**
     * Check if email exists
     * @param {String} email - Email to check
     * @returns {Boolean} True if exists
     */
    static async emailExists(email) {
        const count = await UserDocument.countDocuments({ email: email.toLowerCase() });
        return count > 0;
    }
}

module.exports = User;
