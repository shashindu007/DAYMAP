import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import walletService from '../services/walletService';
import categoryService from '../services/categoryService';
import { useAuth } from './AuthContext';

const WalletContext = createContext(null);

/**
 * Wallet state: one month's summary, its expenses, and the spend categories.
 *
 * Mounted OUTSIDE <Router> beside the other plain data providers. That is what
 * keeps `todaySpend` alive across /today -> /week -> /today without refetching,
 * and it is also why nothing in here may call useToast - the toast provider
 * lives inside Router. The over-budget toast fires from the Wallet page, which
 * is the only place that knows the before-and-after state anyway.
 */
export const WalletProvider = ({ children }) => {
    const { user } = useAuth();

    const [summary, setSummary] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [todaySpend, setTodaySpend] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const resolveErrorMessage = (err, fallback) => (
        err?.errors?.[0]?.message || err?.message || fallback
    );

    const unwrap = (response) => response?.data || response;

    /** Load a month: summary, expenses and spend categories in one go. */
    const fetchWallet = useCallback(async (period = null) => {
        try {
            setLoading(true);
            setError(null);
            const [summaryRes, expensesRes, categoriesRes] = await Promise.all([
                walletService.getSummary(period),
                walletService.getExpenses(period),
                categoryService.getAllCategories('spend')
            ]);

            const summaryData = unwrap(summaryRes);
            const expenseData = unwrap(expensesRes);
            const categoryData = unwrap(categoriesRes);

            setSummary(summaryData || null);
            setExpenses(expenseData?.expenses || []);
            setCategories(categoryData?.categories || []);
            return summaryData;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to load your wallet'));
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    /** Re-read the summary only, after a mutation changed the totals. */
    const refreshSummary = useCallback(async (period = null) => {
        try {
            const response = await walletService.getSummary(period);
            const data = unwrap(response);
            setSummary(data || null);
            return data;
        } catch (err) {
            // The list already reflects the change; a stale KPI row is better
            // than an error banner over a save that actually worked.
            return null;
        }
    }, []);

    /**
     * Adjust today's spend by a delta rather than refetching, so logging an
     * expense on /wallet updates the Today line with zero requests and the two
     * can never disagree.
     */
    const patchTodaySpend = useCallback((date, centsDelta, countDelta) => {
        setTodaySpend((prev) => {
            if (!prev || prev.date !== date) return prev;
            return {
                ...prev,
                spent_cents: Math.max(0, prev.spent_cents + centsDelta),
                count: Math.max(0, prev.count + countDelta)
            };
        });
    }, []);

    /**
     * Fetch today's spend at most once per user per calendar day per session.
     *
     * The dedupe key lives in a ref, not state, and the deps are [user?.id]
     * only. Putting `todaySpend` in the dep array would recreate this function
     * on every render, and the consumer's effect would loop into a request
     * storm on the Today page.
     */
    const todayFetchRef = useRef(null);
    const ensureTodaySpend = useCallback(async () => {
        const key = `${user?.id || ''}|${new Date().toDateString()}`;
        if (!user?.id || todayFetchRef.current === key) return;
        todayFetchRef.current = key;
        try {
            const response = await walletService.getTodaySpend();
            setTodaySpend(unwrap(response) || null);
        } catch {
            // Silent by design: a wallet failure must never surface an error on
            // Today's Dashboard. The line simply does not render.
        }
    }, [user?.id]);

    const createExpense = useCallback(async (payload, period = null) => {
        try {
            setError(null);
            const data = unwrap(await walletService.createExpense(payload));
            if (data) {
                setExpenses((prev) => [data, ...prev]);
                patchTodaySpend(data.date, data.amount_cents, 1);
            }
            await refreshSummary(period);
            return data;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to add expense'));
            throw err;
        }
    }, [patchTodaySpend, refreshSummary]);

    const updateExpense = useCallback(async (id, payload, period = null) => {
        try {
            setError(null);
            const previous = expenses.find((row) => row.id === id);
            const data = unwrap(await walletService.updateExpense(id, payload));
            if (data) {
                setExpenses((prev) => prev.map((row) => (row.id === id ? data : row)));
                // An edit can move an expense on or off today, or change its
                // amount, so back the old one out before adding the new.
                if (previous) patchTodaySpend(previous.date, -previous.amount_cents, -1);
                patchTodaySpend(data.date, data.amount_cents, 1);
            }
            await refreshSummary(period);
            return data;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to update expense'));
            throw err;
        }
    }, [expenses, patchTodaySpend, refreshSummary]);

    const deleteExpense = useCallback(async (id, period = null) => {
        try {
            setError(null);
            const previous = expenses.find((row) => row.id === id);
            await walletService.deleteExpense(id);
            setExpenses((prev) => prev.filter((row) => row.id !== id));
            if (previous) patchTodaySpend(previous.date, -previous.amount_cents, -1);
            await refreshSummary(period);
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to delete expense'));
            throw err;
        }
    }, [expenses, patchTodaySpend, refreshSummary]);

    const saveBudget = useCallback(async ({ id, category_id, amount_cents, period }) => {
        try {
            setError(null);
            // Only the amount is writable on an existing budget; re-targeting
            // is delete + create, enforced by the API.
            if (id) {
                await walletService.updateBudget(id, amount_cents);
            } else {
                await walletService.createBudget({ category_id, amount_cents, period });
            }
            return await refreshSummary(period);
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to save budget'));
            throw err;
        }
    }, [refreshSummary]);

    const deleteBudget = useCallback(async (id, period = null) => {
        try {
            setError(null);
            await walletService.deleteBudget(id);
            return await refreshSummary(period);
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to remove budget'));
            throw err;
        }
    }, [refreshSummary]);

    const createCategory = useCallback(async (payload) => {
        try {
            setError(null);
            const data = unwrap(await categoryService.createCategory({ ...payload, kind: 'spend' }));
            if (data) setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
            return data;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to add category'));
            throw err;
        }
    }, []);

    const deleteCategory = useCallback(async (id, period = null) => {
        try {
            setError(null);
            await categoryService.deleteCategory(id);
            setCategories((prev) => prev.filter((row) => row.id !== id));
            await refreshSummary(period);
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to delete category'));
            throw err;
        }
    }, [refreshSummary]);

    const value = useMemo(() => ({
        summary,
        expenses,
        categories,
        todaySpend,
        loading,
        error,
        setError,
        fetchWallet,
        refreshSummary,
        ensureTodaySpend,
        createExpense,
        updateExpense,
        deleteExpense,
        saveBudget,
        deleteBudget,
        createCategory,
        deleteCategory
    }), [
        summary, expenses, categories, todaySpend, loading, error,
        fetchWallet, refreshSummary, ensureTodaySpend,
        createExpense, updateExpense, deleteExpense,
        saveBudget, deleteBudget, createCategory, deleteCategory
    ]);

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
};

export default WalletContext;
