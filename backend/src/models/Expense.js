const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const expenseSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        // Integer minor units, never a float. duration_minutes is the
        // precedent: nothing in this codebase stores a decimal. Rounding
        // happens exactly once, on the client, in frontend/src/utils/money.js -
        // by the time an amount reaches here it is already a whole number.
        amount_cents: { type: Number, required: true, min: 1 },
        // null means "Uncategorized". A Budget can never target null, so
        // uncategorized spend counts toward the month total but no budget.
        category_id: { type: String, default: null, ref: 'Category' },
        // YYYY-MM-DD in the USER's timezone, derived server-side.
        date: { type: String, required: true },
        note: { type: String, default: '', maxlength: 200, trim: true }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false
    }
);

// Serves the month-range filter and the newest-first sort in one scan.
expenseSchema.index({ user_id: 1, date: -1 });
// Makes the "does this category still have expenses?" delete guard cheap.
expenseSchema.index({ user_id: 1, category_id: 1 });

const ExpenseDocument = mongoose.models.Expense || mongoose.model('Expense', expenseSchema);

class Expense {
    /**
     * Create an expense
     * @param {Object} expenseData
     * @returns {Object} Created expense
     */
    static async create(expenseData) {
        const {
            user_id,
            amount_cents,
            category_id = null,
            date,
            note = ''
        } = expenseData;

        const created = await ExpenseDocument.create({
            id: uuidv4(),
            user_id,
            // Belt-and-braces: the validator's .toInt() is the authority, but a
            // stray float here would poison every $sum downstream.
            amount_cents: Math.round(Number(amount_cents)),
            category_id: category_id || null,
            date,
            note: note || ''
        });

        return await this.findById(created.id);
    }

    /**
     * Find expense by ID
     * @param {String} id
     * @returns {Object|null}
     */
    static async findById(id) {
        return await ExpenseDocument.findOne({ id }).lean();
    }

    /**
     * Expenses within an inclusive YYYY-MM-DD range, newest first.
     * @param {String} userId
     * @param {String} start - YYYY-MM-DD
     * @param {String} end - YYYY-MM-DD
     * @param {Number} limit
     * @returns {Array}
     */
    static async findByRange(userId, start, end, limit = 500) {
        return await ExpenseDocument
            .find({ user_id: userId, date: { $gte: start, $lte: end } })
            .sort({ date: -1, created_at: -1 })
            .limit(limit)
            .lean();
    }

    /**
     * Expenses on one date. Powers the Today line.
     * @param {String} userId
     * @param {String} ymd
     * @returns {Array}
     */
    static async findByDate(userId, ymd) {
        return await ExpenseDocument
            .find({ user_id: userId, date: ymd })
            .sort({ created_at: -1 })
            .lean();
    }

    /**
     * How many expenses reference a category. Gates category deletion.
     * @param {String} userId
     * @param {String} categoryId
     * @returns {Number}
     */
    static async countByCategory(userId, categoryId) {
        return await ExpenseDocument.countDocuments({ user_id: userId, category_id: categoryId });
    }

    /**
     * Update an expense
     * @param {String} id
     * @param {Object} expenseData
     * @returns {Object} Updated expense
     */
    static async update(id, expenseData) {
        const allowedFields = ['amount_cents', 'category_id', 'date', 'note'];
        const updates = {};

        for (const [key, value] of Object.entries(expenseData)) {
            if (value === undefined || !allowedFields.includes(key)) continue;
            if (key === 'amount_cents') {
                updates[key] = Math.round(Number(value));
            } else if (key === 'category_id') {
                updates[key] = value || null;
            } else {
                updates[key] = value;
            }
        }

        if (Object.keys(updates).length === 0) {
            return await this.findById(id);
        }

        await ExpenseDocument.updateOne({ id }, { $set: updates });

        return await this.findById(id);
    }

    /**
     * Delete an expense
     * @param {String} id
     */
    static async delete(id) {
        await ExpenseDocument.deleteOne({ id });
    }
}

module.exports = Expense;
