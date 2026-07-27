import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
} from 'chart.js';
import analyticsService from '../services/analyticsService';
import { useTheme } from '../context/ThemeContext';
import { applyChartTheme, seriesColors, baselineColor } from '../utils/chartTheme';
import './Analytics.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

const formatHourLabel = (hour) => {
    const suffix = hour < 12 ? 'AM' : 'PM';
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${display}${suffix}`;
};

const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const Analytics = () => {
    const { darkMode } = useTheme();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState(null);
    const [daily, setDaily] = useState(null);
    const [weekly, setWeekly] = useState(null);
    const [monthly, setMonthly] = useState(null);
    const [trends, setTrends] = useState([]);
    const [timeManagement, setTimeManagement] = useState(null);
    const [selectedDate, setSelectedDate] = useState(toYmd(new Date()));
    const [trendDays, setTrendDays] = useState(30);

    const loadAnalytics = useCallback(async (options = {}) => {
        const dailyDate = options.dailyDate || selectedDate;
        const trendWindow = options.trendWindow || trendDays;

        try {
            setLoading(true);
            setError('');
            const [summaryRes, dailyRes, weeklyRes, monthlyRes, trendsRes, timeMgmtRes] = await Promise.all([
                analyticsService.getSummary(),
                analyticsService.getDailyAnalytics(dailyDate),
                analyticsService.getWeeklyAnalytics(),
                analyticsService.getMonthlyAnalytics(),
                analyticsService.getTrends(trendWindow),
                analyticsService.getTimeManagement(trendWindow)
            ]);

            setSummary(summaryRes.data);
            setDaily(dailyRes.data);
            setWeekly(weeklyRes.data);
            setMonthly(monthlyRes.data);
            setTrends(trendsRes?.data?.trends || []);
            setTimeManagement(timeMgmtRes?.data || null);
        } catch (loadError) {
            setError(loadError?.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, [selectedDate, trendDays]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    // Re-theme on every theme flip, before the charts render.
    useEffect(() => {
        applyChartTheme(darkMode);
    }, [darkMode]);

    const palette = useMemo(() => seriesColors(darkMode), [darkMode]);

    /* Completion over time is a time series; it was rendered as a table of one
       row per day — at the default 30-day window, 30 rows of raw numbers. */
    const trendChartData = useMemo(() => {
        if (!trends.length) return null;
        return {
            labels: trends.map((row) => row.date),
            datasets: [{
                label: 'Completion %',
                data: trends.map((row) => Number(row.completion_rate || 0)),
                borderColor: palette[0],
                backgroundColor: `${palette[0]}22`,
                pointRadius: trends.length > 45 ? 0 : 2,
                pointHoverRadius: 4,
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        };
    }, [trends, palette]);

    const trendLineOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        interaction: { mode: 'index', intersect: false },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: { callback: (value) => `${value}%` }
            },
            x: { ticks: { maxTicksLimit: 10, autoSkip: true } }
        }
    }), []);

    const hourChartData = useMemo(() => {
        const hours = timeManagement?.hour_distribution;
        if (!hours?.length || hours.every((h) => h.tasks_completed === 0)) return null;

        /* Trim the dead overnight hours instead of plotting 24 buckets where
           a third are always zero-height. */
        const active = hours.filter((h) => h.tasks_completed > 0 || h.time_spent_minutes > 0);
        const first = hours.indexOf(active[0]);
        const last = hours.indexOf(active[active.length - 1]);
        const visible = hours.slice(Math.max(0, first - 1), Math.min(hours.length, last + 2));

        return {
            labels: visible.map((h) => formatHourLabel(h.hour)),
            datasets: [
                {
                    label: 'Tasks completed',
                    data: visible.map((h) => h.tasks_completed),
                    backgroundColor: palette[0],
                    borderRadius: 4,
                    yAxisID: 'y'
                },
                {
                    label: 'Minutes spent',
                    data: visible.map((h) => h.time_spent_minutes),
                    backgroundColor: palette[1],
                    borderRadius: 4,
                    yAxisID: 'y1'
                }
            ]
        };
    }, [timeManagement, palette]);

    const categoryChartData = useMemo(() => {
        const categories = (timeManagement?.by_category || []).slice(0, 8);
        if (!categories.length) return null;
        return {
            labels: categories.map((c) => c.category),
            datasets: [
                {
                    label: 'Planned (min)',
                    data: categories.map((c) => c.planned_minutes),
                    backgroundColor: baselineColor(darkMode),
                    borderRadius: 4
                },
                {
                    label: 'Actual (min)',
                    data: categories.map((c) => c.actual_minutes),
                    backgroundColor: palette[0],
                    borderRadius: 4
                }
            ]
        };
    }, [timeManagement, palette, darkMode]);

    const hourBarOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
            y: { type: 'linear', position: 'left', beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Tasks' } },
            y1: { type: 'linear', position: 'right', beginAtZero: true, grid: { drawOnChartArea: false }, title: { display: true, text: 'Minutes' } }
        }
    }), []);

    const categoryBarOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }), []);

    const pva = timeManagement?.planned_vs_actual;
    const peakHour = timeManagement?.peak_hour;
    const focus = timeManagement?.focus;

    const handleRefresh = () => {
        loadAnalytics();
    };

    const handleApplyFilters = () => {
        loadAnalytics({ dailyDate: selectedDate, trendWindow: trendDays });
    };

    return (
        <div className="analytics-page">
            <div className="analytics-header">
                <h1>Analytics</h1>
                <p>Track productivity trends, completion rates, and time spent.</p>
            </div>

            <section className="analytics-filters card">
                <label>
                    Snapshot date
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                </label>
                <label>
                    Window (days)
                    <input
                        type="number"
                        min="7"
                        max="120"
                        value={trendDays}
                        onChange={(e) => setTrendDays(parseInt(e.target.value, 10) || 30)}
                    />
                </label>
                <div className="analytics-filter-actions">
                    <button className="btn btn-primary" type="button" onClick={handleApplyFilters} disabled={loading}>Apply</button>
                    <button className="btn btn-outline" type="button" onClick={handleRefresh} disabled={loading}>Refresh</button>
                </div>
            </section>

            {error && (
                <p className="alert alert-error" role="alert" aria-live="polite">
                    {error}
                </p>
            )}

            {loading ? (
                /* Six parallel requests meant the whole page blanked on the
                   slowest one. .skeleton has been in App.css all along. */
                <div className="analytics-skeletons" aria-busy="true" aria-label="Loading analytics">
                    <div className="analytics-cards">
                        <div className="skeleton analytics-skeleton-card" />
                        <div className="skeleton analytics-skeleton-card" />
                        <div className="skeleton analytics-skeleton-card" />
                    </div>
                    <div className="skeleton analytics-skeleton-chart" />
                    <div className="skeleton analytics-skeleton-chart" />
                </div>
            ) : (
                <>
                    {/* Three, not six. "Total Spent Time (API)" and "Tracked
                        Focus (Clock)" leaked implementation detail into the UI,
                        and the latter was read once from localStorage in a memo
                        with empty deps — it never refreshed on Apply. */}
                    <section className="analytics-cards">
                        <article className="card">
                            <h3>Completion rate</h3>
                            <p className="analytics-value">{summary?.avg_completion_rate || 0}%</p>
                            <small className="muted">Average across all tracked days</small>
                        </article>
                        <article className="card">
                            <h3>Focus time</h3>
                            <p className="analytics-value">{summary?.focus_time_spent_minutes || 0} min</p>
                            <small className="muted">{summary?.focus_sessions_count || 0} sessions</small>
                        </article>
                        <article className="card">
                            <h3>Time scheduled</h3>
                            <p className="analytics-value">{summary?.total_time_scheduled_minutes || 0} min</p>
                            <small className="muted">{summary?.total_time_spent_minutes || 0} min actually spent</small>
                        </article>
                    </section>

                    <section className="analytics-grid">
                        <article className="card">
                            <h3>Daily Snapshot ({daily?.date || selectedDate})</h3>
                            <ul className="analytics-list">
                                <li><span>Scheduled Tasks</span><strong>{daily?.total_tasks_scheduled || 0}</strong></li>
                                <li><span>Completed Tasks</span><strong>{daily?.total_tasks_completed || 0}</strong></li>
                                <li><span>Completion Rate</span><strong>{daily?.completion_rate || 0}%</strong></li>
                                <li><span>Time Scheduled</span><strong>{daily?.total_time_scheduled_minutes || 0} min</strong></li>
                                <li><span>Time Spent</span><strong>{daily?.total_time_spent_minutes || 0} min</strong></li>
                            </ul>
                        </article>

                        <article className="card">
                            <h3>Weekly Totals</h3>
                            <ul className="analytics-list">
                                <li><span>Date Range</span><strong>{weekly?.start_date} → {weekly?.end_date}</strong></li>
                                <li><span>Scheduled Tasks</span><strong>{weekly?.totals?.total_tasks_scheduled || 0}</strong></li>
                                <li><span>Completed Tasks</span><strong>{weekly?.totals?.total_tasks_completed || 0}</strong></li>
                                <li><span>Completion Rate</span><strong>{weekly?.totals?.completion_rate || 0}%</strong></li>
                                <li><span>Time Spent</span><strong>{weekly?.totals?.total_time_spent_minutes || 0} min</strong></li>
                            </ul>
                        </article>

                        <article className="card">
                            <h3>Monthly Totals</h3>
                            <ul className="analytics-list">
                                <li><span>Month</span><strong>{monthly?.month}/{monthly?.year}</strong></li>
                                <li><span>Scheduled Tasks</span><strong>{monthly?.totals?.total_tasks_scheduled || 0}</strong></li>
                                <li><span>Completed Tasks</span><strong>{monthly?.totals?.total_tasks_completed || 0}</strong></li>
                                <li><span>Avg Daily Tasks</span><strong>{monthly?.totals?.avg_daily_tasks || 0}</strong></li>
                                <li><span>Completion Rate</span><strong>{monthly?.totals?.completion_rate || 0}%</strong></li>
                            </ul>
                        </article>
                    </section>

                    <section className="card">
                        <h3>Productivity trend</h3>
                        <p className="muted">Completion rate over the last {trendDays} days.</p>
                        {trendChartData ? (
                            <div className="analytics-chart">
                                <Line data={trendChartData} options={trendLineOptions} />
                            </div>
                        ) : (
                            <p className="muted">No trend points for the selected period.</p>
                        )}
                    </section>

                    <section className="tm-section">
                        <div className="tm-heading">
                            <h2>Time Management</h2>
                            <p className="muted">How you actually spend time — last {timeManagement?.range?.days || trendDays} days.</p>
                        </div>

                        <div className="tm-callouts">
                            <article className="card tm-callout">
                                <span className="tm-callout-label">Peak productive hour</span>
                                <strong className="tm-callout-value">
                                    {peakHour !== null && peakHour !== undefined ? formatHourLabel(peakHour) : '—'}
                                </strong>
                                <small className="muted">When you complete the most tasks</small>
                            </article>
                            <article className="card tm-callout">
                                <span className="tm-callout-label">Best focus time</span>
                                <strong className="tm-callout-value">
                                    {focus?.best_hour !== null && focus?.best_hour !== undefined ? formatHourLabel(focus.best_hour) : '—'}
                                </strong>
                                <small className="muted">{focus?.best_day ? `Best day: ${focus.best_day}` : 'Most focus minutes'}</small>
                            </article>
                            <article className="card tm-callout">
                                <span className="tm-callout-label">Estimate accuracy</span>
                                <strong className="tm-callout-value">
                                    {pva?.accuracy_pct !== null && pva?.accuracy_pct !== undefined ? `${pva.accuracy_pct}%` : '—'}
                                </strong>
                                <small className="muted">
                                    {pva
                                        ? `${pva.total_actual_minutes} min actual vs ${pva.total_planned_minutes} min planned`
                                        : 'Actual vs planned time'}
                                </small>
                            </article>
                        </div>

                        <div className="tm-grid">
                            <article className="card tm-chart-card">
                                <h3>Peak Productive Hours</h3>
                                <p className="muted">Tasks completed and minutes spent by hour of day.</p>
                                {hourChartData ? (
                                    <div className="tm-chart">
                                        <Bar data={hourChartData} options={hourBarOptions} />
                                    </div>
                                ) : (
                                    <p className="muted">No completed tasks with times in this period.</p>
                                )}
                            </article>

                            <article className="card tm-chart-card">
                                <h3>Time by Category — Planned vs Actual</h3>
                                <p className="muted">Where your time goes, and how estimates hold up.</p>
                                {categoryChartData ? (
                                    <div className="tm-chart">
                                        <Bar data={categoryChartData} options={categoryBarOptions} />
                                    </div>
                                ) : (
                                    <p className="muted">No category time data yet.</p>
                                )}
                            </article>
                        </div>

                        {timeManagement?.by_category?.length > 0 && (
                            <div className="trend-table-wrap">
                                <table className="trend-table">
                                    <thead>
                                        <tr>
                                            <th>Category</th>
                                            <th>Tasks</th>
                                            <th>Completed</th>
                                            <th>Planned (min)</th>
                                            <th>Actual (min)</th>
                                            <th>Variance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timeManagement.by_category.map((row) => (
                                            <tr key={row.category}>
                                                <td>{row.category}</td>
                                                <td>{row.tasks}</td>
                                                <td>{row.completed}</td>
                                                <td>{row.planned_minutes}</td>
                                                <td>{row.actual_minutes}</td>
                                                <td className={row.variance_minutes > 0 ? 'tm-over' : 'tm-under'}>
                                                    {row.variance_minutes > 0 ? '+' : ''}{row.variance_minutes} min
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}
        </div>
    );
};

export default Analytics;
