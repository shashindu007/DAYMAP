const { mongoose } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const budgetSchema = new mongoose.Schema(
    {
        id: { type: String, required: true, unique: true, default: uuidv4 },
        user_id: { type: String, required: true, ref: 'User' },
        category_id: { type: String, required: true, ref: 'Category' },
        // 'YYYY-MM'. One scalar, so the unique index below is exact and the
        // key cannot be internally inconsistent the way a start/end pair can.
        // Joins to an expense by expense.date.slice(0, 7) - no date maths.
        period: { type: String, required: true, maxlength: 7 },
        amount_cents: { type: Number, required: true, min: 1 }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false
    }
);

// The rule that stops two budgets for the same category in the same month.
// Also serves find({ user_id, period }) as an index prefix, so a separate
// { user_id, period } index would be dead weight.
budgetSchema.index({ user_id: 1, period: 1, category_id: 1 }, { unique: true });

const BudgetDocument = mongoose.models.Budget || mongoose.model('Budget', budgetSchema);

class Budget {
    /**
     * Create a budget
     * @param {Object} budgetData
     * @returns {Object} Created budget
     */
    static async create(budgetData) {
        const { user_id, category_id, period, amount_cents } = budgetData;

        const created = await BudgetDocument.create({
            id: uuidv4(),
            user_id,
            category_id,
            period,
            amount_cents: Math.round(Number(amount_cents))
        });

        return await this.findById(created.id);
    }

    /**
     * Find budget by ID
     * @param {String} id
     * @returns {Object|null}
     */
    static async findById(id) {
        return await BudgetDocument.findOne({ id }).lean();
    }

    /**
     * Every budget for one month.
     * @param {String} userId
     * @param {String} period - YYYY-MM
     * @returns {Array}
     */
    static async findByPeriod(userId, period) {
        return await BudgetDocument.find({ user_id: userId, period }).lean();
    }

    /**
     * The single budget for one category in one month, if any.
     * @param {String} userId
     * @param {String} period - YYYY-MM
     * @param {String} categoryId
     * @returns {Object|null}
     */
    static async findOneFor(userId, period, categoryId) {
        return await BudgetDocument.findOne({
            user_id: userId,
            period,
            category_id: categoryId
        }).lean();
    }

    /**
     * Update a budget.
     *
     * The whitelist is the amount and nothing else, deliberately: letting a PUT
     * change category_id or period lets it collide with the unique index, and
     * updateOne would surface that as a bare E11000 -> 500. Re-targeting a
     * budget is delete + create.
     *
     * @param {String} id
     * @param {Object} budgetData
     * @returns {Object} Updated budget
     */
    static async update(id, budgetData) {
        const allowedFields = ['amount_cents'];
        const updates = {};

        for (const [key, value] of Object.entries(budgetData)) {
            if (value === undefined || !allowedFields.includes(key)) continue;
            updates[key] = Math.round(Number(value));
        }

        if (Object.keys(updates).length === 0) {
            return await this.findById(id);
        }

        await BudgetDocument.updateOne({ id }, { $set: updates });

        return await this.findById(id);
    }

    /**
     * Delete a budget
     * @param {String} id
     */
    static async delete(id) {
        await BudgetDocument.deleteOne({ id });
    }

    /**
     * Remove every budget pointing at a category. Used when a category with no
     * expenses is deleted - the budgets would otherwise be unreachable rows.
     * @param {String} userId
     * @param {String} categoryId
     */
    static async deleteByCategory(userId, categoryId) {
        await BudgetDocument.deleteMany({ user_id: userId, category_id: categoryId });
    }
}

module.exports = Budget;
