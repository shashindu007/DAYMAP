import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Tooltip,
    Legend
} from 'chart.js';
import { useFocus } from '../context/FocusContext';
import { useTheme } from '../context/ThemeContext';
import analyticsService from '../services/analyticsService';
import { applyChartTheme, seriesColors } from '../utils/chartTheme';
import { toYmd, extractFocusPayload, resolveFocusErrorMessage } from '../utils/focusTime';
import './FocusDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const EMPTY_TOTALS = {
    focus_time_spent_minutes: 0,
    focus_sessions_count: 0,
    focus_sessions_total: 0,
    focus_sessions_completed: 0
};

const EMPTY_PATTERNS = {
    todayMinutes: 0,
    todaySessions: 0,
    avgDailyMinutes: 0,
    avgSessionsPerDay: 0,
    bestDay: null
};

const EMPTY_INSIGHTS = {
    totals: EMPTY_TOTALS,
    daily: [],
    weekly: [],
    byCategory: [],
    byTag: [],
    insights: []
};

/* Series colours come from utils/chartTheme so they track the theme; this file
   used to carry its own hardcoded palette that never changed in dark mode. */

/**
 * The focus analytics page. The session engine itself lives in FocusContext
 * and is driven from the FocusSessionPanel on the Today dashboard; this page
 * only reads that shared state to render momentum and weekly insights.
 */
const FocusDashboard = () => {
    // sessionsVersion / lastSessionResponse are the engine's way of saying
    // "a session was logged" without knowing that charts exist.
    const { focusGoal, sessionsVersion, lastSessionResponse } = useFocus();
    const { darkMode } = useTheme();

    const todayYmd = useMemo(() => toYmd(new Date()), []);

    // Chart.js reads its defaults at render time, so re-theme on every flip.
    useEffect(() => {
        applyChartTheme(darkMode);
    }, [darkMode]);

    const palette = useMemo(() => seriesColors(darkMode), [darkMode]);

    const [focusPatterns, setFocusPatterns] = useState(EMPTY_PATTERNS);
    const [focusInsights, setFocusInsights] = useState(EMPTY_INSIGHTS);
    const [focusInsightsLoading, setFocusInsightsLoading] = useState(false);
    const [focusInsightsError, setFocusInsightsError] = useState('');

    const loadFocusInsights = useCallback(async () => {
        try {
            setFocusInsightsLoading(true);
            setFocusInsightsError('');
            const response = await analyticsService.getFocusInsights(14);
            const data = extractFocusPayload(response);
            const daily = data.daily || [];
            const today = daily.find((item) => item.date === todayYmd) || null;

            setFocusPatterns({
                todayMinutes: today?.focus_time_spent_minutes || 0,
                todaySessions: today?.focus_sessions_count || 0,
                avgDailyMinutes: data.avg_daily_focus_minutes || 0,
                avgSessionsPerDay: data.avg_sessions_per_day || 0,
                bestDay: data.best_focus_day?.date ? data.best_focus_day : null
            });

            setFocusInsights({
                totals: data.totals || EMPTY_TOTALS,
                daily,
                weekly: data.weekly || [],
                byCategory: data.by_category || [],
                byTag: data.by_tag || [],
                insights: data.insights || []
            });
        } catch (error) {
            setFocusInsightsError(resolveFocusErrorMessage(error, 'Failed to load focus insights.'));
            setFocusPatterns(EMPTY_PATTERNS);
            setFocusInsights(EMPTY_INSIGHTS);
        } finally {
            setFocusInsightsLoading(false);
        }
    }, [todayYmd]);

    const applyTodayFocusUpdate = useCallback((payload) => {
        const data = extractFocusPayload(payload);
        if (!data || !data.date) return;

        setFocusPatterns((prev) => ({
            ...prev,
            todayMinutes: data.focus_time_spent_minutes ?? prev.todayMinutes,
            todaySessions: data.focus_sessions_count ?? prev.todaySessions
        }));

        setFocusInsights((prev) => {
            if (!prev || !Array.isArray(prev.daily)) return prev;
            const updatedDaily = prev.daily.some((item) => item.date === data.date)
                ? prev.daily.map((item) => (
                    item.date === data.date
                        ? {
                            ...item,
                            focus_time_spent_minutes: data.focus_time_spent_minutes ?? item.focus_time_spent_minutes,
                            focus_sessions_count: data.focus_sessions_count ?? item.focus_sessions_count,
                            focus_sessions_total: data.focus_sessions_total ?? item.focus_sessions_total,
                            focus_sessions_completed: data.focus_sessions_completed ?? item.focus_sessions_completed
                        }
                        : item
                ))
                : [...prev.daily, {
                    date: data.date,
                    focus_time_spent_minutes: data.focus_time_spent_minutes || 0,
                    focus_sessions_count: data.focus_sessions_count || 0,
                    focus_sessions_total: data.focus_sessions_total || 0,
                    focus_sessions_completed: data.focus_sessions_completed || 0
                }].sort((a, b) => a.date.localeCompare(b.date));

            const totals = updatedDaily.reduce((acc, item) => {
                acc.focus_time_spent_minutes += item.focus_time_spent_minutes || 0;
                acc.focus_sessions_count += item.focus_sessions_count || 0;
                acc.focus_sessions_total += item.focus_sessions_total || 0;
                acc.focus_sessions_completed += item.focus_sessions_completed || 0;
                return acc;
            }, { ...EMPTY_TOTALS });

            return { ...prev, daily: updatedDaily, totals };
        });
    }, []);

    useEffect(() => {
        loadFocusInsights();
    }, [loadFocusInsights]);

    // Refresh whenever the engine reports a newly logged session.
    useEffect(() => {
        if (!sessionsVersion) return;
        loadFocusInsights();
    }, [loadFocusInsights, sessionsVersion]);

    useEffect(() => {
        if (!lastSessionResponse) return;
        applyTodayFocusUpdate(lastSessionResponse);
    }, [applyTodayFocusUpdate, lastSessionResponse]);

    const dailyChartData = useMemo(() => {
        if (!focusInsights.daily?.length) return null;
        return {
            labels: focusInsights.daily.map((item) => item.date.slice(5)),
            datasets: [
                {
                    label: 'Focus minutes',
                    data: focusInsights.daily.map((item) => item.focus_time_spent_minutes || 0),
                    backgroundColor: palette[0],
                    borderRadius: 4
                }
            ]
        };
    }, [focusInsights.daily, palette]);

    const weeklyChartData = useMemo(() => {
        if (!focusInsights.weekly?.length) return null;
        return {
            labels: focusInsights.weekly.map((item) => item.week_start.slice(5)),
            datasets: [
                {
                    label: 'Weekly focus minutes',
                    data: focusInsights.weekly.map((item) => item.focus_time_spent_minutes || 0),
                    backgroundColor: palette[2],
                    borderRadius: 4
                }
            ]
        };
    }, [focusInsights.weekly, palette]);

    const categoryChartData = useMemo(() => {
        if (!focusInsights.byCategory?.length) return null;
        return {
            labels: focusInsights.byCategory.map((item) => item.label),
            datasets: [
                {
                    label: 'Category distribution',
                    data: focusInsights.byCategory.map((item) => item.minutes || 0),
                    backgroundColor: focusInsights.byCategory.map((_, index) => palette[index % palette.length]),
                    borderWidth: 0
                }
            ]
        };
    }, [focusInsights.byCategory, palette]);

    const barOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }), []);

    const pieOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
    }), []);

    return (
        <div className="focus-dashboard-container">
            <div className="focus-header">
                <div>
                    <h1>Focus Metrics</h1>
                    <p className="muted">Review your focus momentum and weekly insights. Start a session from Focus Mode on the Today dashboard.</p>
                </div>
            </div>

            <div className="focus-layout focus-layout-stacked">
                <section className="card focus-stats focus-section">
                    <h2>Focus Metrics</h2>
                    <p className="muted">Track your momentum across the last two weeks.</p>

                    {focusInsightsError && <p className="alert alert-error">{focusInsightsError}</p>}

                    {focusInsightsLoading && !focusInsights.daily.length ? (
                        <p className="muted">Loading focus insights...</p>
                    ) : null}

                    <div className="focus-insights-grid">
                        <div>
                            <span className="profile-label">Today Focus</span>
                            <p>{focusPatterns.todayMinutes} min ({focusPatterns.todaySessions} sessions)</p>
                        </div>
                        <div>
                            <span className="profile-label">14-day Average</span>
                            <p>{Number(focusPatterns.avgDailyMinutes || 0).toFixed(1)} min/day</p>
                        </div>
                        <div>
                            <span className="profile-label">Avg Sessions/Day</span>
                            <p>{Number(focusPatterns.avgSessionsPerDay || 0).toFixed(2)}</p>
                        </div>
                        <div>
                            <span className="profile-label">Best Focus Day</span>
                            <p>
                                {focusPatterns.bestDay
                                    ? `${focusPatterns.bestDay.date} (${focusPatterns.bestDay.focus_time_spent_minutes} min)`
                                    : 'No data yet'}
                            </p>
                        </div>
                        <div>
                            <span className="profile-label">Total Focus Time</span>
                            <p>{focusInsights.totals.focus_time_spent_minutes || 0} min</p>
                        </div>
                        <div>
                            <span className="profile-label">Completed Sessions</span>
                            <p>{focusInsights.totals.focus_sessions_completed || 0}</p>
                        </div>
                        <div>
                            <span className="profile-label">Focus Success Rate</span>
                            <p>
                                {focusInsights.totals.focus_sessions_total
                                    ? `${Math.round((focusInsights.totals.focus_sessions_completed / focusInsights.totals.focus_sessions_total) * 100)}%`
                                    : '0%'}
                            </p>
                        </div>
                    </div>

                    <div className="focus-chart-grid">
                        <div className="focus-chart-card">
                            <h3>Daily Focus Minutes</h3>
                            {dailyChartData ? (
                                <div className="focus-chart">
                                    <Bar data={dailyChartData} options={barOptions} />
                                </div>
                            ) : (
                                <p className="muted focus-chart-empty">No daily focus data yet.</p>
                            )}
                        </div>
                        <div className="focus-chart-card">
                            <h3>Weekly Focus Minutes</h3>
                            {weeklyChartData ? (
                                <div className="focus-chart">
                                    <Bar data={weeklyChartData} options={barOptions} />
                                </div>
                            ) : (
                                <p className="muted focus-chart-empty">No weekly focus data yet.</p>
                            )}
                        </div>
                        <div className="focus-chart-card">
                            <h3>Category Distribution</h3>
                            {categoryChartData ? (
                                <div className="focus-chart">
                                    <Pie data={categoryChartData} options={pieOptions} />
                                </div>
                            ) : (
                                <p className="muted focus-chart-empty">Add categories to see distribution.</p>
                            )}
                        </div>
                        <div className="focus-chart-card">
                            <h3>Set your focus goal</h3>
                            {focusGoal ? (
                                <div className="focus-goal-card">
                                    <p>{focusGoal}</p>
                                </div>
                            ) : (
                                <p className="muted focus-chart-empty">Set a goal in Focus Mode on the Today dashboard to keep your session aligned.</p>
                            )}
                        </div>
                    </div>

                    <div className="focus-insights-list">
                        <h3>Productivity Insights</h3>
                        {focusInsights.insights.length === 0 ? (
                            <p className="muted">Complete a focus session to unlock insights.</p>
                        ) : (
                            <ul>
                                {focusInsights.insights.map((insight) => (
                                    <li key={insight}>{insight}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default FocusDashboard;
