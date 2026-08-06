import api from './api';

/**
 * Wallet API. Amounts are integer minor units in both directions - see
 * utils/money.js for the conversion at the keyboard edge.
 *
 * Omitting `period` lets the server resolve the current month in the user's
 * timezone, which is always more correct than the browser guessing.
 */
const walletService = {
    /** Month summary: KPI totals plus the per-category budget-vs-spend join. */
    getSummary: async (period = null) => {
        return api.get(period ? `/wallet/summary?period=${period}` : '/wallet/summary');
    },

    /** Today's spend, for the line on Today's Dashboard. */
    getTodaySpend: async () => {
        return api.get('/wallet/today');
    },

    getExpenses: async (period = null) => {
        return api.get(period ? `/wallet/expenses?period=${period}` : '/wallet/expenses');
    },

    createExpense: async (expenseData) => {
        return api.post('/wallet/expenses', expenseData);
    },

    updateExpense: async (id, expenseData) => {
        return api.put(`/wallet/expenses/${id}`, expenseData);
    },

    deleteExpense: async (id) => {
        return api.delete(`/wallet/expenses/${id}`);
    },

    getBudgets: async (period = null) => {
        return api.get(period ? `/wallet/budgets?period=${period}` : '/wallet/budgets');
    },

    createBudget: async (budgetData) => {
        return api.post('/wallet/budgets', budgetData);
    },

    /** Only the amount is writable; re-targeting is delete + create. */
    updateBudget: async (id, amountCents) => {
        return api.put(`/wallet/budgets/${id}`, { amount_cents: amountCents });
    },

    deleteBudget: async (id) => {
        return api.delete(`/wallet/budgets/${id}`);
    }
};

export default walletService;
