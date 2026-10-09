import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
} from 'chart.js';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import useCurrency from '../hooks/useCurrency';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { applyChartTheme, seriesColors } from '../utils/chartTheme';
import { useTheme } from '../context/ThemeContext';
import { budgetState, barPercent, percentOf, isValidExpenseCents } from '../utils/money';
import {
    currentYearMonth, shiftYearMonth, monthLabel, dayLabel, weekdayDayLabel, localYmd
} from '../utils/monthDates';
import WalletCalendar from '../components/wallet/WalletCalendar';
import './Wallet.css';

// Registered here rather than relying on FocusDashboard having imported
// ArcElement as a side-effect - that breaks the day someone code-splits.
ChartJS.register(ArcElement, Tooltip, Legend);

/** Six categories most people actually track, for a brand-new wallet. */
const STARTER_CATEGORIES = [
    { name: 'Food', color: '#e11d48' },
    { name: 'Transport', color: '#0891b2' },
    { name: 'Bills', color: '#7c3aed' },
    { name: 'Shopping', color: '#d97706' },
    { name: 'Health', color: '#059669' },
    { name: 'Other', color: '#64748b' }
];

const EMPTY_EXPENSE = { amount: '', category_id: '', date: '', note: '' };

const Wallet = () => {
    const {
        summary, expenses, categories, todaySpend, loading, error,
        fetchWallet, ensureTodaySpend, createExpense, updateExpense, deleteExpense,
        saveBudget, deleteBudget, createCategory
    } = useWallet();
    const { pushToast } = useToast();
    const { format, parse, currency } = useCurrency();
    const { darkMode } = useTheme();

    const [period, setPeriod] = useState(currentYearMonth);
    const [form, setForm] = useState(EMPTY_EXPENSE);
    const [editingId, setEditingId] = useState(null);
    const [formOpen, setFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState('');
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [budgetDraft, setBudgetDraft] = useState({ categoryId: null, value: '' });
    const [seeding, setSeeding] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);

    useEffect(() => { applyChartTheme(darkMode); }, [darkMode]);
    const palette = useMemo(() => seriesColors(darkMode), [darkMode]);

    useEffect(() => {
        fetchWallet(period).catch(() => null);
    }, [fetchWallet, period]);

    // The server owns the user's real today, resolved in their timezone. This
    // is deduped per user per calendar day per session, so it costs nothing if
    // Today's dashboard has already been visited.
    useEffect(() => {
        ensureTodaySpend();
    }, [ensureTodaySpend]);

    // A day number means nothing once the month behind it has changed.
    useEffect(() => {
        setSelectedDay(null);
    }, [period]);

    const totals = summary?.totals;
    const rows = useMemo(() => summary?.categories || [], [summary]);
    const isCurrentMonth = period === currentYearMonth();

    // The browser's guess is only the bridge until /wallet/today resolves.
    const todayYmd = todaySpend?.date || localYmd();
    // A past month has no today.
    const calendarToday = todayYmd.startsWith(`${period}-`) ? todayYmd : null;

    /** Spend categories by id - the rollups and the expense rows all need it. */
    const categoryById = useMemo(
        () => new Map(categories.map((category) => [category.id, category])),
        [categories]
    );

    /** What the expense list shows: one day, or the whole month. */
    const visibleExpenses = useMemo(() => (
        selectedDay ? expenses.filter((row) => row.date === selectedDay) : expenses
    ), [expenses, selectedDay]);

    /**
     * The selected day rolled up per category, in the SAME shape as the API's
     * monthly `categories` rows - so the chart consumes either scope without
     * knowing which one it is drawing.
     *
     * Built from the expenses already in memory: GET /wallet/expenses returns
     * the whole period, so picking a day costs no request.
     */
    const dayRows = useMemo(() => {
        if (!selectedDay) return null;
        const byKey = new Map();
        visibleExpenses.forEach((expense) => {
            // Uncategorized expenses share one bucket, exactly as buildSummary
            // does on the server - otherwise every note would be its own slice.
            const key = expense.category_id || 'uncategorized';
            let row = byKey.get(key);
            if (!row) {
                const category = expense.category_id ? categoryById.get(expense.category_id) : null;
                row = {
                    category_id: expense.category_id || null,
                    name: category?.name || 'Uncategorized',
                    color: category?.color || null,
                    spent_cents: 0,
                    expense_count: 0
                };
                byKey.set(key, row);
            }
            row.spent_cents += expense.amount_cents;
            row.expense_count += 1;
        });
        return Array.from(byKey.values()).sort((a, b) => b.spent_cents - a.spent_cents);
    }, [selectedDay, visibleExpenses, categoryById]);

    /** Category id -> what that category took on the selected day. Empty when
     *  no day is picked, which is what switches the day layer off everywhere. */
    const daySpentByCategory = useMemo(() => {
        const map = new Map();
        (dayRows || []).forEach((row) => map.set(row.category_id, row.spent_cents));
        return map;
    }, [dayRows]);

    /** Categories with a budget or some spend, plus any with neither. */
    const budgetRows = useMemo(() => {
        const byId = new Map(rows.filter((row) => row.category_id).map((row) => [row.category_id, row]));
        return categories.map((category) => {
            const row = byId.get(category.id);
            return {
                category_id: category.id,
                name: category.name,
                color: category.color,
                budget_id: row?.budget_id || null,
                spent_cents: row?.spent_cents || 0,
                budget_cents: row?.budget_cents || 0,
                day_spent_cents: daySpentByCategory.get(category.id) || 0
            };
        }).sort((a, b) => (
            // With a day picked the categories that day touched lead; the month
            // order would otherwise bury them under untouched ones. Every day
            // figure is 0 with no day picked, so this falls straight through to
            // the original month ordering.
            b.day_spent_cents - a.day_spent_cents
            || b.spent_cents - a.spent_cents
            || a.name.localeCompare(b.name)
        ));
    }, [categories, rows, daySpentByCategory]);

    /** Headline numbers for the picked day, for the band above the tiles. */
    const dayTotals = useMemo(() => {
        if (!selectedDay) return null;
        const spentCents = visibleExpenses.reduce((sum, row) => sum + row.amount_cents, 0);
        return {
            spent_cents: spentCents,
            count: visibleExpenses.length,
            category_count: (dayRows || []).length,
            // Share of the month's spend, not of its budget: this answers "how
            // much of what I spent went on this day".
            share: percentOf(spentCents, totals?.spent_cents || 0)
        };
    }, [selectedDay, visibleExpenses, dayRows, totals]);

    /** One day when a day is picked, the whole month otherwise. Memoized only
     *  so chartSlices below keeps a stable dependency. */
    const chartRows = useMemo(
        () => (selectedDay ? (dayRows || []) : rows),
        [selectedDay, dayRows, rows]
    );
    const scopeLabel = selectedDay ? weekdayDayLabel(selectedDay) : monthLabel(period);

    /**
     * Slices for the doughnut AND the legend beside it, from one source - a
     * colour or a percentage can never disagree between the two.
     */
    const chartSlices = useMemo(() => {
        const spent = chartRows.filter((row) => row.spent_cents > 0);
        const total = spent.reduce((sum, row) => sum + row.spent_cents, 0);
        return spent.map((row, index) => ({
            key: row.category_id || 'uncategorized',
            name: row.name,
            // Category colour is user-owned, so a slice keeps its colour
            // between renders instead of tracking its position.
            color: row.color || palette[index % palette.length],
            spent_cents: row.spent_cents,
            share: percentOf(row.spent_cents, total)
        }));
    }, [chartRows, palette]);

    const chartTotalCents = useMemo(
        () => chartSlices.reduce((sum, slice) => sum + slice.spent_cents, 0),
        [chartSlices]
    );

    const chartData = useMemo(() => {
        if (chartSlices.length === 0) return null;
        return {
            labels: chartSlices.map((slice) => slice.name),
            datasets: [{
                data: chartSlices.map((slice) => slice.spent_cents),
                backgroundColor: chartSlices.map((slice) => slice.color),
                borderWidth: 0,
                hoverOffset: 6
            }]
        };
    }, [chartSlices]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        // Wider hole than the old 58%: the total and the scope now live in it,
        // which is what tells you at a glance whether you are reading a day or
        // a month. 70% leaves a hole wide enough for a seven-figure amount
        // without wrapping it.
        cutout: '70%',
        plugins: {
            // Chart.js's own legend has nowhere to put an amount or a share, so
            // the legend is rendered as HTML beside the arc instead.
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context) => (
                        ` ${context.label}: ${format(context.parsed)} · ${percentOf(context.parsed, chartTotalCents)}%`
                    )
                }
            }
        }
    }), [format, chartTotalCents]);

    const resetForm = useCallback(() => {
        setForm(EMPTY_EXPENSE);
        setEditingId(null);
        setFormOpen(false);
        setLocalError('');
    }, []);

    const startCreate = () => {
        // A selected day is the strongest signal of intent, ahead of both the
        // blank-means-today shortcut and the 1st-of-month fallback.
        setForm({ ...EMPTY_EXPENSE, date: selectedDay || (isCurrentMonth ? '' : `${period}-01`) });
        setEditingId(null);
        setLocalError('');
        setFormOpen(true);
    };

    const startEdit = (expense) => {
        setForm({
            // Show the amount as a normal decimal; parse() turns it back into
            // minor units on save.
            amount: (expense.amount_cents / (10 ** (currency === 'JPY' ? 0 : 2))).toString(),
            category_id: expense.category_id || '',
            date: expense.date,
            note: expense.note || ''
        });
        setEditingId(expense.id);
        setLocalError('');
        setFormOpen(true);
    };

    const handleField = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLocalError('');

        const amountCents = parse(form.amount);
        if (!isValidExpenseCents(amountCents)) {
            setLocalError('Enter an amount greater than zero, for example 1,250.00');
            return;
        }

        const payload = {
            amount_cents: amountCents,
            category_id: form.category_id || null,
            note: form.note.trim()
        };
        if (form.date) payload.date = form.date;

        // Captured before the save so the toast can fire on the transition
        // only - never for a category that was already over.
        const before = rows.find((row) => row.category_id === payload.category_id);
        const replacing = editingId ? expenses.find((row) => row.id === editingId) : null;
        // The delta this save adds to that category. An edit that moves an
        // expense INTO the category adds the whole amount; one that stays put
        // adds only the difference.
        const delta = amountCents - (
            replacing && replacing.category_id === payload.category_id ? replacing.amount_cents : 0
        );

        try {
            setSaving(true);
            if (editingId) {
                await updateExpense(editingId, payload, period);
            } else {
                await createExpense(payload, period);
            }
            resetForm();
            maybeWarnOverBudget(before, delta);
        } catch (err) {
            setLocalError(err?.errors?.[0]?.message || err?.message || 'Failed to save the expense.');
        } finally {
            setSaving(false);
        }
    };

    /**
     * Warn only when this save is what pushed the category over. Never on load,
     * never on a refetch, never when it was already over before.
     *
     * The new total is computed from the delta rather than read back off
     * `summary`: that state belongs to the render this handler closed over, so
     * it still holds the pre-save numbers even though refreshSummary has run.
     */
    const maybeWarnOverBudget = (before, delta) => {
        if (!before || before.budget_cents <= 0 || delta <= 0) return;
        if (before.spent_cents > before.budget_cents) return;

        const after = before.spent_cents + delta;
        if (after <= before.budget_cents) return;

        pushToast({
            title: `${before.name} is over budget`,
            // Overspending is a fact, not an error - warning, not danger.
            body: `${format(after - before.budget_cents)} over your ${format(before.budget_cents)} budget for ${monthLabel(period)}.`,
            tone: 'warning',
            tag: `budget-over-${before.category_id}`
        });
    };

    const handleConfirmDelete = async () => {
        if (!pendingDelete) return;
        try {
            setDeleting(true);
            await deleteExpense(pendingDelete.id, period);
            setPendingDelete(null);
        } catch (err) {
            setLocalError(err?.message || 'Failed to delete the expense.');
        } finally {
            setDeleting(false);
        }
    };

    const submitBudget = async (row) => {
        const amountCents = parse(budgetDraft.value);
        if (!isValidExpenseCents(amountCents)) {
            setLocalError('Enter a budget greater than zero.');
            return;
        }
        try {
            await saveBudget({
                id: row.budget_id,
                category_id: row.category_id,
                amount_cents: amountCents,
                period
            });
            setBudgetDraft({ categoryId: null, value: '' });
            setLocalError('');
        } catch (err) {
            setLocalError(err?.errors?.[0]?.message || err?.message || 'Failed to save the budget.');
        }
    };

    const seedCategories = async () => {
        try {
            setSeeding(true);
            // Sequential, not Promise.all: the unique index rejects duplicates
            // and one failure should not abandon the rest.
            for (const category of STARTER_CATEGORIES) {
                await createCategory(category).catch(() => null);
            }
            await fetchWallet(period);
        } finally {
            setSeeding(false);
        }
    };

    const hasAnything = categories.length > 0 || expenses.length > 0;

    return (
        <div className="wallet-page container">
            <header className="wallet-header">
                <div>
                    <h1>Wallet</h1>
                    <p className="wallet-subtitle">
                        What you spent, and what you meant to spend.
                    </p>
                </div>

                <div className="wallet-header-actions">
                    <div className="wallet-month">
                        <button
                            type="button"
                            className="wallet-month-btn"
                            onClick={() => setPeriod((prev) => shiftYearMonth(prev, -1))}
                            aria-label="Previous month"
                        >
                            ‹
                        </button>
                        <span className="wallet-month-label">{monthLabel(period)}</span>
                        <button
                            type="button"
                            className="wallet-month-btn"
                            onClick={() => setPeriod((prev) => shiftYearMonth(prev, 1))}
                            disabled={isCurrentMonth}
                            aria-label="Next month"
                        >
                            ›
                        </button>
                    </div>

                    {hasAnything && (
                        <button type="button" className="btn btn-primary" onClick={startCreate}>
                            Add expense
                        </button>
                    )}
                </div>
            </header>

            {(localError || error) && (
                <p className="alert alert-error" role="alert" aria-live="polite">
                    {localError || error}
                </p>
            )}

            {loading && !summary ? (
                <p className="muted">Loading your wallet…</p>
            ) : !hasAnything ? (
                <section className="card wallet-empty">
                    <h2>Track where your money goes</h2>
                    <p>
                        Add a few spending categories, set a monthly budget for each, and log what
                        you spend. DayMap will show you how much is left before the month runs out.
                    </p>
                    <div className="wallet-empty-actions">
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={seedCategories}
                            disabled={seeding}
                        >
                            {seeding ? 'Adding…' : 'Add starter categories'}
                        </button>
                        <button type="button" className="btn btn-outline" onClick={startCreate}>
                            Log an expense
                        </button>
                    </div>
                </section>
            ) : (
                <>
                    {/* The one place that states the filter in words. Without it
                        a day's chart beside the month's KPI tiles just reads as
                        two numbers that disagree. */}
                    {selectedDay && dayTotals && (
                        <section className="wallet-dayband" aria-live="polite">
                            <div className="wallet-dayband-main">
                                <span className="wallet-dayband-chip">{weekdayDayLabel(selectedDay)}</span>
                                <span className="wallet-dayband-value">{format(dayTotals.spent_cents)}</span>
                                <span className="wallet-dayband-meta">
                                    {dayTotals.count} expense{dayTotals.count === 1 ? '' : 's'}
                                    {' · '}
                                    {dayTotals.category_count} categor{dayTotals.category_count === 1 ? 'y' : 'ies'}
                                    {' · '}
                                    {dayTotals.share}% of {monthLabel(period)}
                                </span>
                            </div>
                            <div className="wallet-dayband-actions">
                                <button type="button" className="btn btn-sm btn-primary" onClick={startCreate}>
                                    Add for this day
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-ghost"
                                    onClick={() => setSelectedDay(null)}
                                >
                                    Show whole month
                                </button>
                            </div>
                        </section>
                    )}

                    <section className="wallet-cards">
                        <article className="card">
                            <h3>Spent</h3>
                            <p className="wallet-value">{format(totals?.spent_cents || 0)}</p>
                            <small className="muted wallet-card-note">
                                {totals?.expense_count || 0} expense{totals?.expense_count === 1 ? '' : 's'} this month
                            </small>
                        </article>

                        <article className="card">
                            <h3>Budget</h3>
                            <p className="wallet-value">{format(totals?.budget_cents || 0)}</p>
                            <small className="muted wallet-card-note">
                                across {budgetRows.filter((row) => row.budget_cents > 0).length} categor
                                {budgetRows.filter((row) => row.budget_cents > 0).length === 1 ? 'y' : 'ies'}
                            </small>
                        </article>

                        <article className="card">
                            <h3>{(totals?.remaining_cents ?? 0) < 0 ? 'Over by' : 'Left'}</h3>
                            <p className={`wallet-value ${(totals?.remaining_cents ?? 0) < 0 ? 'wallet-over' : 'wallet-under'}`}>
                                {format(Math.abs(totals?.remaining_cents || 0))}
                            </p>
                            <small className="muted wallet-card-note">
                                {totals?.budget_cents ? 'against your budget' : 'no budget set yet'}
                            </small>
                        </article>

                        <article className="card">
                            <h3>Over budget</h3>
                            <p className={`wallet-value ${totals?.over_budget_count ? 'wallet-over' : ''}`}>
                                {totals?.over_budget_count || 0}
                            </p>
                            <small className="muted wallet-card-note">
                                categor{totals?.over_budget_count === 1 ? 'y' : 'ies'} past the limit
                            </small>
                        </article>
                    </section>

                    <section className="card">
                        <div className="wallet-section-head">
                            <h2>Spending calendar</h2>
                            <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                                {selectedDay
                                    ? 'Tap the same day again to go back to the month'
                                    : 'Pick a day to filter the budgets, the chart and the list'}
                            </span>
                        </div>
                        <WalletCalendar
                            period={period}
                            expenses={expenses}
                            budgetCents={totals?.budget_cents || 0}
                            selectedDay={selectedDay}
                            onSelectDay={setSelectedDay}
                            todayYmd={calendarToday}
                        />
                    </section>

                    <div className="wallet-grid">
                        <section className="card">
                            <div className="wallet-section-head">
                                <h2>Budgets</h2>
                                <span className="wallet-scope">{monthLabel(period)}</span>
                            </div>

                            {/* A budget is a MONTHLY promise, so the bar stays
                                monthly even with a day picked - the day is drawn
                                as a lit segment inside it rather than replacing
                                it, which would compare a day against a month. */}
                            {selectedDay && budgetRows.length > 0 && (
                                <p className="wallet-scope-note">
                                    <span className="wallet-scope-key" aria-hidden />
                                    The lit part of each bar is {weekdayDayLabel(selectedDay)}; the bar is the whole month.
                                </p>
                            )}

                            {budgetRows.length === 0 ? (
                                <p className="muted">No spending categories yet.</p>
                            ) : (
                                <div className="wallet-budget-list">
                                    {budgetRows.map((row) => {
                                        const state = budgetState(row.spent_cents, row.budget_cents);
                                        const remaining = row.budget_cents - row.spent_cents;
                                        const editing = budgetDraft.categoryId === row.category_id;
                                        // The day's slice of this category's month, drawn at the
                                        // leading edge of the fill. Relative to the month's spend,
                                        // so it stays right even when the fill is clamped at 100%.
                                        const dayShareOfMonth = selectedDay && row.spent_cents > 0
                                            ? barPercent(row.day_spent_cents, row.spent_cents)
                                            : 0;
                                        const untouched = Boolean(selectedDay) && row.day_spent_cents === 0;
                                        return (
                                            <div
                                                className={`wallet-budget-row${untouched ? ' is-quiet' : ''}`}
                                                key={row.category_id}
                                            >
                                                <div className="wallet-budget-top">
                                                    <span className="wallet-budget-name">
                                                        <span
                                                            className="wallet-dot"
                                                            style={row.color ? { background: row.color } : undefined}
                                                            aria-hidden
                                                        />
                                                        {row.name}
                                                    </span>
                                                    <span className="wallet-budget-amounts">
                                                        {selectedDay && (
                                                            <>
                                                                {/* An em dash, not a formatted zero: thirty
                                                                    "LKR 0.00"s would drown the one category
                                                                    that actually saw money that day. */}
                                                                <strong className={`wallet-budget-day${untouched ? ' is-zero' : ''}`}>
                                                                    {untouched ? '—' : format(row.day_spent_cents)}
                                                                </strong>
                                                                <span className="wallet-budget-sep" aria-hidden>·</span>
                                                            </>
                                                        )}
                                                        {format(row.spent_cents)}
                                                        {row.budget_cents > 0 && ` / ${format(row.budget_cents)}`}
                                                    </span>
                                                </div>

                                                <div className="wallet-track">
                                                    <div
                                                        className={`wallet-fill is-${state}`}
                                                        style={{ width: `${barPercent(row.spent_cents, row.budget_cents)}%` }}
                                                    >
                                                        {dayShareOfMonth > 0 && (
                                                            <span
                                                                className="wallet-fill-day"
                                                                style={{ width: `${dayShareOfMonth}%` }}
                                                            />
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="wallet-budget-foot">
                                                    {row.budget_cents > 0 ? (
                                                        <span className={remaining < 0 ? 'wallet-over' : 'wallet-under'}>
                                                            {/* The word carries the state, not just the colour. */}
                                                            {format(Math.abs(remaining))} {remaining < 0 ? 'over' : 'left'}
                                                            {selectedDay ? ' this month' : ''}
                                                            {state === 'over' && <span className="badge badge-rose" style={{ marginLeft: 'var(--space-2)' }}>Over</span>}
                                                        </span>
                                                    ) : (
                                                        <span className="muted">No budget set</span>
                                                    )}

                                                    {editing ? (
                                                        <span className="wallet-inline-form">
                                                            <input
                                                                className="input"
                                                                type="text"
                                                                inputMode="decimal"
                                                                autoFocus
                                                                value={budgetDraft.value}
                                                                onChange={(e) => setBudgetDraft((prev) => ({ ...prev, value: e.target.value }))}
                                                                aria-label={`Budget for ${row.name}`}
                                                            />
                                                            <button type="button" className="btn btn-sm btn-primary" onClick={() => submitBudget(row)}>
                                                                Save
                                                            </button>
                                                            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setBudgetDraft({ categoryId: null, value: '' })}>
                                                                Cancel
                                                            </button>
                                                        </span>
                                                    ) : (
                                                        <span className="wallet-budget-actions">
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-ghost"
                                                                onClick={() => setBudgetDraft({ categoryId: row.category_id, value: '' })}
                                                            >
                                                                {row.budget_cents > 0 ? 'Change' : 'Set budget'}
                                                            </button>
                                                            {row.budget_id && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-danger-quiet"
                                                                    onClick={() => deleteBudget(row.budget_id, period).catch(() => null)}
                                                                >
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        <section className="card">
                            <div className="wallet-section-head">
                                <h2>Where it went</h2>
                                <span className={`wallet-scope${selectedDay ? ' is-day' : ''}`}>
                                    {scopeLabel}
                                </span>
                            </div>
                            {chartData ? (
                                <div className="wallet-chart-wrap">
                                    <div className="wallet-chart">
                                        <Doughnut data={chartData} options={chartOptions} />
                                        {/* In the hole rather than above the arc: the total and
                                            the scope are the two things you need to know before
                                            reading a single slice. */}
                                        <div className="wallet-chart-center">
                                            <span className="wallet-chart-total">{format(chartTotalCents)}</span>
                                            <span className="wallet-chart-scope">{scopeLabel}</span>
                                        </div>
                                    </div>

                                    {/* The canvas is unreadable to a screen reader, so this list
                                        is the chart's text equivalent as well as its legend. */}
                                    <ul className="wallet-legend">
                                        {chartSlices.map((slice) => (
                                            <li className="wallet-legend-row" key={slice.key}>
                                                <span
                                                    className="wallet-dot"
                                                    style={{ background: slice.color }}
                                                    aria-hidden
                                                />
                                                <span className="wallet-legend-name">{slice.name}</span>
                                                <span className="wallet-legend-amount">{format(slice.spent_cents)}</span>
                                                <span className="wallet-legend-share">{slice.share}%</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <div className="wallet-chart-empty">
                                    <p className="muted">
                                        {selectedDay
                                            ? `Nothing spent on ${weekdayDayLabel(selectedDay)}.`
                                            : `Nothing spent in ${monthLabel(period)} yet.`}
                                    </p>
                                    {selectedDay && (
                                        <div className="wallet-empty-actions">
                                            <button type="button" className="btn btn-sm btn-primary" onClick={startCreate}>
                                                Add for this day
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-ghost"
                                                onClick={() => setSelectedDay(null)}
                                            >
                                                Show whole month
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>

                    <section className="card">
                        <div className="wallet-section-head">
                            <h2>
                                Expenses
                                {selectedDay && (
                                    <>
                                        {' '}<span aria-hidden>·</span> {weekdayDayLabel(selectedDay)}
                                    </>
                                )}
                            </h2>
                            <span className="wallet-section-head-actions">
                                {selectedDay && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-ghost wallet-day-clear"
                                        onClick={() => setSelectedDay(null)}
                                        aria-label={`Show all of ${monthLabel(period)}`}
                                    >
                                        ×
                                    </button>
                                )}
                                <button type="button" className="btn btn-sm btn-primary" onClick={startCreate}>
                                    Add expense
                                </button>
                            </span>
                        </div>

                        {formOpen && (
                            <form className="wallet-form" onSubmit={handleSubmit} aria-busy={saving}>
                                <div className="wallet-form-grid">
                                    <div className="wallet-field">
                                        <label htmlFor="wallet-amount">Amount ({currency})</label>
                                        <input
                                            id="wallet-amount"
                                            className="input"
                                            name="amount"
                                            type="text"
                                            inputMode="decimal"
                                            placeholder="1,250.00"
                                            value={form.amount}
                                            onChange={handleField}
                                            autoFocus
                                        />
                                    </div>

                                    <div className="wallet-field">
                                        <label htmlFor="wallet-category">Category</label>
                                        <select
                                            id="wallet-category"
                                            className="input"
                                            name="category_id"
                                            value={form.category_id}
                                            onChange={handleField}
                                        >
                                            <option value="">Uncategorized</option>
                                            {categories.map((category) => (
                                                <option key={category.id} value={category.id}>{category.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="wallet-field">
                                        <label htmlFor="wallet-date">Date</label>
                                        <input
                                            id="wallet-date"
                                            className="input"
                                            name="date"
                                            type="date"
                                            value={form.date}
                                            onChange={handleField}
                                        />
                                    </div>

                                    <div className="wallet-field">
                                        <label htmlFor="wallet-note">Note</label>
                                        <input
                                            id="wallet-note"
                                            className="input"
                                            name="note"
                                            type="text"
                                            maxLength={200}
                                            placeholder="Lunch"
                                            value={form.note}
                                            onChange={handleField}
                                        />
                                    </div>
                                </div>

                                <div className="wallet-form-actions">
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add expense'}
                                    </button>
                                    <button type="button" className="btn btn-ghost" onClick={resetForm}>
                                        Cancel
                                    </button>
                                    <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                                        Leave the date empty for today.
                                    </span>
                                </div>
                            </form>
                        )}

                        {visibleExpenses.length === 0 ? (
                            <p className="muted">
                                {selectedDay
                                    ? `No expenses on ${weekdayDayLabel(selectedDay)}.`
                                    : `No expenses in ${monthLabel(period)}.`}
                            </p>
                        ) : (
                            <div className="wallet-expense-list">
                                {visibleExpenses.map((expense) => {
                                    const category = categoryById.get(expense.category_id);
                                    return (
                                        <div className="wallet-expense" key={expense.id}>
                                            <span className="wallet-expense-date">{dayLabel(expense.date)}</span>
                                            <span className="wallet-expense-main">
                                                <span className="wallet-expense-note">
                                                    {expense.note || 'Expense'}
                                                </span>
                                                <span className="wallet-expense-cat">
                                                    {category?.name || 'Uncategorized'}
                                                </span>
                                            </span>
                                            <span className="wallet-expense-amount">
                                                {format(expense.amount_cents)}
                                            </span>
                                            <span className="wallet-expense-actions">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-ghost"
                                                    onClick={() => startEdit(expense)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-danger-quiet"
                                                    onClick={() => setPendingDelete(expense)}
                                                >
                                                    Delete
                                                </button>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </>
            )}

            {pendingDelete && (
                <ConfirmDialog
                    title="Delete this expense?"
                    description={`${format(pendingDelete.amount_cents)}${pendingDelete.note ? ` — ${pendingDelete.note}` : ''} will be removed from ${monthLabel(period)}.`}
                    busy={deleting}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setPendingDelete(null)}
                />
            )}
        </div>
    );
};

export default Wallet;
