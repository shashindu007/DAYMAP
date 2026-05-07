import React, { useCallback, useEffect, useMemo, useState } from 'react';
import analyticsService from '../services/analyticsService';
import './Analytics.css';

const TASK_TIME_STORAGE_KEY = 'daymap_task_time_v1';

const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const Analytics = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState(null);
    const [daily, setDaily] = useState(null);
    const [weekly, setWeekly] = useState(null);
    const [monthly, setMonthly] = useState(null);
    const [trends, setTrends] = useState([]);
    const [selectedDate, setSelectedDate] = useState(toYmd(new Date()));
    const [trendDays, setTrendDays] = useState(30);

    const loadAnalytics = useCallback(async (options = {}) => {
        const dailyDate = options.dailyDate || selectedDate;
        const trendWindow = options.trendWindow || trendDays;

        try {
            setLoading(true);
            setError('');
            const [summaryRes, dailyRes, weeklyRes, monthlyRes, trendsRes] = await Promise.all([
                analyticsService.getSummary(),
                analyticsService.getDailyAnalytics(dailyDate),
                analyticsService.getWeeklyAnalytics(),
                analyticsService.getMonthlyAnalytics(),
                analyticsService.getTrends(trendWindow)
            ]);

            setSummary(summaryRes.data);
            setDaily(dailyRes.data);
            setWeekly(weeklyRes.data);
            setMonthly(monthlyRes.data);
            setTrends(trendsRes?.data?.trends || []);
        } catch (loadError) {
            setError(loadError?.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, [selectedDate, trendDays]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    const trackedMinutes = useMemo(() => {
        try {
            const raw = localStorage.getItem(TASK_TIME_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            const totalSeconds = Object.values(parsed).reduce((acc, value) => acc + (Number(value) || 0), 0);
            return Math.round(totalSeconds / 60);
        } catch {
            return 0;
        }
    }, []);

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
                    Daily date
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                </label>
                <label>
                    Trend window (days)
                    <input
                        type="number"
                        min="7"
                        max="120"
                        value={trendDays}
                        onChange={(e) => setTrendDays(parseInt(e.target.value, 10) || 30)}
                    />
                </label>
                <div className="analytics-filter-actions">
                    <button className="btn btn-secondary" type="button" onClick={handleApplyFilters} disabled={loading}>Apply</button>
                    <button className="btn btn-outline" type="button" onClick={handleRefresh} disabled={loading}>Refresh</button>
                </div>
            </section>

            {error && (
                <p className="dashboard-error" role="alert" aria-live="polite">
                    {error}
                </p>
            )}

            {loading ? (
                <p className="muted">Loading analytics...</p>
            ) : (
                <>
                    <section className="analytics-cards">
                        <article className="card">
                            <h3>Average Completion Rate</h3>
                            <p className="analytics-value">{summary?.avg_completion_rate || 0}%</p>
                        </article>
                        <article className="card">
                            <h3>Total Scheduled Time</h3>
                            <p className="analytics-value">{summary?.total_time_scheduled_minutes || 0} min</p>
                        </article>
                        <article className="card">
                            <h3>Total Spent Time (API)</h3>
                            <p className="analytics-value">{summary?.total_time_spent_minutes || 0} min</p>
                        </article>
                        <article className="card">
                            <h3>Tracked Focus (Clock)</h3>
                            <p className="analytics-value">{trackedMinutes} min</p>
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
                        <h3>Productivity Trends</h3>
                        {trends.length === 0 ? (
                            <p className="muted">No trend points for the selected period.</p>
                        ) : (
                            <div className="trend-table-wrap">
                                <table className="trend-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Scheduled</th>
                                            <th>Completed</th>
                                            <th>Completion %</th>
                                            <th>Time (hours)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trends.map((row) => (
                                            <tr key={row.date}>
                                                <td>{row.date}</td>
                                                <td>{row.total_tasks}</td>
                                                <td>{row.completed_tasks}</td>
                                                <td>{Number(row.completion_rate || 0).toFixed(1)}%</td>
                                                <td>{row.time_spent_hours}</td>
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
