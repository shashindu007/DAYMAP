const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { normalizeNotificationPreferences } = require('../utils/notificationPrefs');
const { DEFAULT_CURRENCY, normalizeCurrency } = require('../utils/currency');

// _id: false on both subschemas - otherwise Mongoose injects ObjectIds into
// the JSON the frontend receives and round-trips back on save.
const quietHoursSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    start: { type: String, default: '22:00', maxlength: 5 },
    end: { type: String, default: '07:00', maxlength: 5 }
}, { _id: false });

const notificationPreferencesSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: true },
    lead_minutes: { type: Number, default: 30, min: 0, max: 240 },
    notify_on_start: { type: Boolean, default: true },
    notify_on_end: { type: Boolean, default: true },
    daily_digest: { type: Boolean, default: true },
    digest_time: { type: String, default: '07:00', maxlength: 5 },
    quiet_hours: { type: quietHoursSchema, default: () => ({}) },
    browser_push: { type: Boolean, default: false }
}, { _id: false });

// NOTE: Major migration change - SQL table -> Mongoose schema.
const userSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        email: { type: String, required: true, unique: true, trim: true, lowercase: true },
        password_hash: { type: String, required: true },
        name: { type: String, required: true, minlength: 2, maxlength: 100, trim: true },
        timezone: { type: String, default: 'UTC', maxlength: 50 },
        // One currency per user. Wallet amounts are integer minor units and are
        // never converted - changing this reinterprets stored numbers, it does
        // not convert them.
        currency: { type: String, default: DEFAULT_CURRENCY, maxlength: 3 },
        notification_preferences: { type: notificationPreferencesSchema, default: () => ({}) },
        profile_image: { type: String, default: null, maxlength: 3000000 },
        bio: { type: String, default: null, maxlength: 500 },
        phone: { type: String, default: null, maxlength: 30 },
        location: { type: String, default: null, maxlength: 120 }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false
    }
);

const UserDocument = mongoose.models.User || mongoose.model('User', userSchema);

const toPlain = (doc) => (doc ? doc.toObject ? doc.toObject() : doc : null);

class User {
    /**
     * Create a new user
     * @param {Object} userData - User data
     * @returns {Object} Created user
     */
    static async create(userData) {
        const {
            email,
            password_hash,
            name,
            timezone = 'UTC',
            profile_image = null,
            bio = null,
            phone = null,
            location = null
        } = userData;
        const created = await UserDocument.create({
            id: uuidv4(),
            email,
            password_hash,
            name,
            timezone,
            profile_image,
            bio,
            phone,
            location
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
        // Accounts created before notifications shipped have no preference
        // subtree - schema defaults only fire on create, not on read.
        user.notification_preferences = normalizeNotificationPreferences(user.notification_preferences);
        // Same trap: accounts predating the wallet have no currency at all.
        user.currency = normalizeCurrency(user.currency);
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
        // A field missing from this list is silently dropped on save - the
        // request still returns 200 with the unchanged user, which is the
        // hardest kind of bug to notice. Adding a field here is not optional.
        const allowedFields = [
            'name', 'email', 'timezone', 'profile_image', 'bio', 'phone', 'location',
            'notification_preferences', 'currency'
        ];
        const updates = {};

        for (const [key, value] of Object.entries(userData)) {
            if (value === undefined || !allowedFields.includes(key)) continue;

            if (key === 'currency') {
                // Reject an unsupported code by falling back rather than
                // storing something Intl.NumberFormat will later throw on.
                updates[key] = normalizeCurrency(value);
            } else if (key === 'notification_preferences') {
                // $set on an object field REPLACES the whole subdocument, so a
                // partial payload like { lead_minutes: 45 } would drop every
                // other preference. Merge over what is stored, then normalize,
                // so a partial update changes only what it names.
                const existing = await this.findById(id);
                updates[key] = normalizeNotificationPreferences({
                    ...(existing?.notification_preferences || {}),
                    ...value,
                    quiet_hours: {
                        ...(existing?.notification_preferences?.quiet_hours || {}),
                        ...(value.quiet_hours || {})
                    }
                });
            } else {
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
