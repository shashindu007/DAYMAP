const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const {
    getUserYmd,
    getUserYearMonth,
    monthRange,
    isYearMonth
} = require('../utils/date');

/**
 * Wallet: expenses and monthly per-category budgets.
 *
 * TIMEZONE RULE for this file: no bare `new Date()` except as the baseDate
 * argument to getUserYmd/getUserYearMonth. analyticsController builds ranges
 * from new Date().toISOString().split('T')[0], which is UTC and ignores
 * req.user.timezone - that is the outlier in this codebase, not the pattern,
 * and copying it would file a late-evening purchase under the wrong day and
 * potentially the wrong month.
 */

/** Resolve ?period=YYYY-MM, defaulting to the user's current month. */
const resolvePeriod = (req) => {
    const requested = req.query.period;
    if (requested === undefined || requested === '') {
        return { period: getUserYearMonth(req.user.timezone) };
    }
    if (!isYearMonth(requested)) return { error: 'period must be in YYYY-MM format' };
    return { period: requested };
};

const isDuplicateKey = (error) => error && (error.code === 11000 || error.code === 11001);

/**
 * Join expenses to budgets by category for one month.
 *
 * Done in JS with a Map rather than an aggregation pipeline, matching
 * analyticsController's category rollup. The join is a left-outer against a
 * second collection that must also surface categories holding a budget but
 * zero spend - clumsy as a pipeline, trivial here, and the volumes are a few
 * hundred rows a month.
 */
const buildSummary = (expenses, budgets, categories) => {
    const categoryById = new Map(categories.map((row) => [row.id, row]));

    const rowFor = (map, categoryId) => {
        const key = categoryId || 'uncategorized';
        if (!map.has(key)) {
            const category = categoryId ? categoryById.get(categoryId) : null;
            map.set(key, {
                category_id: categoryId || null,
                name: category ? category.name : 'Uncategorized',
                color: category ? category.color : null,
                icon: category ? category.icon : null,
                spent_cents: 0,
                budget_cents: 0,
                expense_count: 0
            });
        }
        return map.get(key);
    };

    const rows = new Map();

    let spent_cents = 0;
    expenses.forEach((expense) => {
        const row = rowFor(rows, expense.category_id);
        row.spent_cents += expense.amount_cents;
        row.expense_count += 1;
        spent_cents += expense.amount_cents;
    });

    let budget_cents = 0;
    budgets.forEach((budget) => {
        // A budget for a category that was since deleted should not resurrect
        // a phantom row; categoryById is the authority on what still exists.
        if (!categoryById.has(budget.category_id)) return;
        const row = rowFor(rows, budget.category_id);
        row.budget_cents += budget.amount_cents;
        row.budget_id = budget.id;
        budget_cents += budget.amount_cents;
    });

    const categoryRows = Array.from(rows.values())
        .map((row) => ({
            ...row,
            remaining_cents: row.budget_cents > 0 ? row.budget_cents - row.spent_cents : null,
            over: row.budget_cents > 0 && row.spent_cents > row.budget_cents
        }))
        .sort((a, b) => b.spent_cents - a.spent_cents);

    return {
        totals: {
            spent_cents,
            budget_cents,
            remaining_cents: budget_cents - spent_cents,
            expense_count: expenses.length,
            over_budget_count: categoryRows.filter((row) => row.over).length
        },
        categories: categoryRows
    };
};

class WalletController {
    /**
     * Month summary: KPI totals plus the per-category budget-vs-spend join.
     * One call powers the whole page.
     * @route GET /api/wallet/summary?period=YYYY-MM
     */
    static async getSummary(req, res) {
        try {
            const { period, error } = resolvePeriod(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const range = monthRange(period);
            const [expenses, budgets, categories] = await Promise.all([
                Expense.findByRange(req.user.id, range.start, range.end),
                Budget.findByPeriod(req.user.id, period),
                Category.findByUser(req.user.id, 'spend')
            ]);

            const summary = buildSummary(expenses, budgets, categories);

            res.json({
                success: true,
                data: {
                    period,
                    range,
                    currency: req.user.currency,
                    ...summary
                }
            });
        } catch (error) {
            console.error('Get wallet summary error:', error);
            res.status(500).json({ success: false, message: 'Error fetching wallet summary' });
        }
    }

    /**
     * Today's spend, for the one-line summary on Today's Dashboard.
     * @route GET /api/wallet/today
     */
    static async getTodaySpend(req, res) {
        try {
            const date = getUserYmd(req.user.timezone);
            const expenses = await Expense.findByDate(req.user.id, date);

            res.json({
                success: true,
                data: {
                    date,
                    spent_cents: expenses.reduce((sum, row) => sum + row.amount_cents, 0),
                    count: expenses.length
                }
            });
        } catch (error) {
            console.error('Get today spend error:', error);
            res.status(500).json({ success: false, message: 'Error fetching today\'s spend' });
        }
    }

    /**
     * Expenses for a month, newest first.
     * @route GET /api/wallet/expenses?period=YYYY-MM
     */
    static async getExpenses(req, res) {
        try {
            const { period, error } = resolvePeriod(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const range = monthRange(period);
            const expenses = await Expense.findByRange(req.user.id, range.start, range.end);

            res.json({
                success: true,
                data: { period, range, expenses, count: expenses.length }
            });
        } catch (error) {
            console.error('Get expenses error:', error);
            res.status(500).json({ success: false, message: 'Error fetching expenses' });
        }
    }

    /**
     * @route POST /api/wallet/expenses
     */
    static async createExpense(req, res) {
        try {
            const { amount_cents, category_id = null, date, note = '' } = req.body;

            if (category_id) {
                const category = await Category.findById(category_id);
                if (!category || category.user_id !== req.user.id) {
                    return res.status(400).json({ success: false, message: 'Unknown category' });
                }
                if (category.kind !== 'spend') {
                    return res.status(400).json({ success: false, message: 'Category is not a spending category' });
                }
            }

            const expense = await Expense.create({
                user_id: req.user.id,
                amount_cents,
                category_id,
                // Missing date means "now", resolved in the user's timezone.
                date: date || getUserYmd(req.user.timezone),
                note
            });

            res.status(201).json({
                success: true,
                message: 'Expense added successfully',
                data: expense
            });
        } catch (error) {
            console.error('Create expense error:', error);
            res.status(500).json({ success: false, message: 'Error creating expense' });
        }
    }

    /**
     * @route PUT /api/wallet/expenses/:id
     */
    static async updateExpense(req, res) {
        try {
            const expense = await Expense.findById(req.params.id);
            if (!expense) {
                return res.status(404).json({ success: false, message: 'Expense not found' });
            }
            if (expense.user_id !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Unauthorized access to expense' });
            }

            if (req.body.category_id) {
                const category = await Category.findById(req.body.category_id);
                if (!category || category.user_id !== req.user.id || category.kind !== 'spend') {
                    return res.status(400).json({ success: false, message: 'Unknown category' });
                }
            }

            const updated = await Expense.update(req.params.id, req.body);

            res.json({
                success: true,
                message: 'Expense updated successfully',
                data: updated
            });
        } catch (error) {
            console.error('Update expense error:', error);
            res.status(500).json({ success: false, message: 'Error updating expense' });
        }
    }

    /**
     * @route DELETE /api/wallet/expenses/:id
     */
    static async deleteExpense(req, res) {
        try {
            const expense = await Expense.findById(req.params.id);
            if (!expense) {
                return res.status(404).json({ success: false, message: 'Expense not found' });
            }
            if (expense.user_id !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Unauthorized access to expense' });
            }

            await Expense.delete(req.params.id);

            res.json({ success: true, message: 'Expense deleted successfully' });
        } catch (error) {
            console.error('Delete expense error:', error);
            res.status(500).json({ success: false, message: 'Error deleting expense' });
        }
    }

    /**
     * @route GET /api/wallet/budgets?period=YYYY-MM
     */
    static async getBudgets(req, res) {
        try {
            const { period, error } = resolvePeriod(req);
            if (error) return res.status(400).json({ success: false, message: error });

            const budgets = await Budget.findByPeriod(req.user.id, period);

            res.json({
                success: true,
                data: { period, budgets, count: budgets.length }
            });
        } catch (error) {
            console.error('Get budgets error:', error);
            res.status(500).json({ success: false, message: 'Error fetching budgets' });
        }
    }

    /**
     * @route POST /api/wallet/budgets
     */
    static async createBudget(req, res) {
        try {
            const { category_id, amount_cents } = req.body;
            const period = req.body.period || getUserYearMonth(req.user.timezone);

            if (!isYearMonth(period)) {
                return res.status(400).json({ success: false, message: 'period must be in YYYY-MM format' });
            }

            const category = await Category.findById(category_id);
            if (!category || category.user_id !== req.user.id) {
                return res.status(400).json({ success: false, message: 'Unknown category' });
            }
            if (category.kind !== 'spend') {
                return res.status(400).json({ success: false, message: 'Category is not a spending category' });
            }

            // Pre-check so a duplicate reads as a 400 with a real message
            // rather than the unique index throwing E11000 into the catch.
            const existing = await Budget.findOneFor(req.user.id, period, category_id);
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: 'A budget already exists for this category this month'
                });
            }

            const budget = await Budget.create({
                user_id: req.user.id,
                category_id,
                period,
                amount_cents
            });

            res.status(201).json({
                success: true,
                message: 'Budget saved successfully',
                data: budget
            });
        } catch (error) {
            // Backstop for the race between the pre-check and the insert.
            if (isDuplicateKey(error)) {
                return res.status(400).json({
                    success: false,
                    message: 'A budget already exists for this category this month'
                });
            }
            console.error('Create budget error:', error);
            res.status(500).json({ success: false, message: 'Error creating budget' });
        }
    }

    /**
     * @route PUT /api/wallet/budgets/:id
     */
    static async updateBudget(req, res) {
        try {
            const budget = await Budget.findById(req.params.id);
            if (!budget) {
                return res.status(404).json({ success: false, message: 'Budget not found' });
            }
            if (budget.user_id !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Unauthorized access to budget' });
            }

            // Only amount_cents is writable - see Budget.update.
            const updated = await Budget.update(req.params.id, req.body);

            res.json({
                success: true,
                message: 'Budget updated successfully',
                data: updated
            });
        } catch (error) {
            console.error('Update budget error:', error);
            res.status(500).json({ success: false, message: 'Error updating budget' });
        }
    }

    /**
     * @route DELETE /api/wallet/budgets/:id
     */
    static async deleteBudget(req, res) {
        try {
            const budget = await Budget.findById(req.params.id);
            if (!budget) {
                return res.status(404).json({ success: false, message: 'Budget not found' });
            }
            if (budget.user_id !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Unauthorized access to budget' });
            }

            await Budget.delete(req.params.id);

            res.json({ success: true, message: 'Budget removed successfully' });
        } catch (error) {
            console.error('Delete budget error:', error);
            res.status(500).json({ success: false, message: 'Error deleting budget' });
        }
    }
}

module.exports = WalletController;
