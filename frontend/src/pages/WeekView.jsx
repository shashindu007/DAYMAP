import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import taskService from '../services/taskService';
import routineService from '../services/routineService';
import scheduleService from '../services/scheduleService';
import analyticsService from '../services/analyticsService';
import Button from '../components/common/Button';
import TaskSection from '../components/tasks/TaskSection';
import TaskCard from '../components/tasks/TaskCard';
import { normalizeDayItem } from '../utils/dayItems';
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from '../utils/taskStatus';
import './WeekView.css';

const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const titleCase = (value) => (
    value
        ? value
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        : ''
);

const getWeekRange = (baseDate = new Date()) => {
    const today = new Date(baseDate);
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
        start,
        end,
        startYmd: toYmd(start),
        endYmd: toYmd(end)
    };
};

// Module-level stale-while-revalidate cache: returning to /week renders the
// last-known week instantly, then a silent background refresh updates it.
// Replaces the old full-page spinner + 30s polling that made loads feel slow.
let weekCache = null; // { key, payload }

const WeekView = () => {
    const navigate = useNavigate();
    const { startYmd, endYmd } = useMemo(() => getWeekRange(), []);
    const cacheKey = `${startYmd}:${endYmd}`;
    const seeded = weekCache && weekCache.key === cacheKey ? weekCache.payload : null;

    const [weekItems, setWeekItems] = useState(seeded?.weekItems || []);
    const [routines, setRoutines] = useState(seeded?.routines || []);
    const [weeklyAnalytics, setWeeklyAnalytics] = useState(seeded?.weeklyAnalytics || null);
    const [weeklyTrends, setWeeklyTrends] = useState(seeded?.weeklyTrends || []);
    const [loading, setLoading] = useState(!seeded);
    const [error, setError] = useState('');

    const loadWeekData = useCallback(async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true);
            setError('');

            const [tasksResponse, scheduleResponse, routinesResponse, weeklyResponse, trendsResponse] = await Promise.all([
                taskService.getWeekTasks(startYmd, endYmd),
                // Read-only: the week summary only displays schedule tasks, it
                // must not trigger the per-day routine materialization writes.
                scheduleService.getScheduleRange(startYmd, endYmd, { materialize: false }),
                routineService.getAllRoutines(),
                analyticsService.getWeeklyAnalytics(startYmd, endYmd),
                analyticsService.getTrends(7)
            ]);

            const taskPayload = tasksResponse?.data?.data || tasksResponse?.data || tasksResponse;
            const taskList = taskPayload?.tasks || taskPayload?.data?.tasks || [];

            const schedulePayload = scheduleResponse?.data?.data || scheduleResponse?.data || scheduleResponse;
            const scheduleList = schedulePayload?.tasks || schedulePayload?.data?.tasks || schedulePayload || [];

            const normalizedScheduleItems = scheduleList
                .map((task) => normalizeDayItem(task, 'schedule'))
                .filter(Boolean);
            const normalizedTaskItems = taskList
                .map((task) => normalizeDayItem(task, 'task'))
                .filter(Boolean);

            // Surface the calendar date on each card (Today only ever shows one
            // day, so its startLabel is time-only; a week spans seven days).
            const withDates = [...normalizedScheduleItems, ...normalizedTaskItems].map((item) => {
                const date = item.raw?.scheduled_date || null;
                return {
                    ...item,
                    date,
                    startLabel: [date, item.startLabel].filter(Boolean).join(' • ')
                };
            });

            const nextRoutinePayload = routinesResponse?.data?.data || routinesResponse?.data || routinesResponse;
            const nextRoutines = nextRoutinePayload?.routines || nextRoutinePayload?.data?.routines || [];

            const weeklyPayload = weeklyResponse?.data?.data || weeklyResponse?.data || weeklyResponse;
            const nextWeeklyAnalytics = weeklyPayload?.data || weeklyPayload;

            const trendsPayload = trendsResponse?.data?.data || trendsResponse?.data || trendsResponse;
            const nextTrends = trendsPayload?.trends || trendsPayload?.data?.trends || [];

            setWeekItems(withDates);
            setRoutines(nextRoutines);
            setWeeklyAnalytics(nextWeeklyAnalytics);
            setWeeklyTrends(nextTrends);

            weekCache = {
                key: cacheKey,
                payload: {
                    weekItems: withDates,
                    routines: nextRoutines,
                    weeklyAnalytics: nextWeeklyAnalytics,
                    weeklyTrends: nextTrends
                }
            };
        } catch (loadError) {
            setError(loadError?.message || 'Failed to load weekly data');
        } finally {
            setLoading(false);
        }
    }, [startYmd, endYmd, cacheKey]);

    useEffect(() => {
        // Seeded from cache → refresh silently so the page never blanks out.
        loadWeekData({ silent: Boolean(seeded) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadWeekData]);

    // Refresh on tab focus / visibility instead of polling every 30s.
    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState !== 'visible') return;
            loadWeekData({ silent: true });
        };
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [loadWeekData]);

    const tasksByCategory = useMemo(() => {
        const grouped = new Map();
        weekItems.forEach((item) => {
            const key = item.category?.trim() || 'Uncategorized';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(item);
        });

        return Array.from(grouped.entries())
            .map(([category, items]) => ({
                category,
                items: items.sort((a, b) => {
                    const dateCompare = (a.date || '').localeCompare(b.date || '');
                    if (dateCompare !== 0) return dateCompare;
                    return (a.startLabel || '').localeCompare(b.startLabel || '');
                })
            }))
            .sort((a, b) => a.category.localeCompare(b.category));
    }, [weekItems]);

    const routinesByType = useMemo(() => {
        const grouped = new Map();
        routines.forEach((routine) => {
            const key = routine.recurrence?.type || 'daily';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(routine);
        });

        return Array.from(grouped.entries())
            .map(([type, items]) => ({
                type,
                items: items.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            }))
            .sort((a, b) => a.type.localeCompare(b.type));
    }, [routines]);

    const weeklyStats = useMemo(() => {
        const filtered = weekItems.filter((item) => item.status !== 'cancelled');
        const total = filtered.length;
        const completed = filtered.filter((item) => item.status === 'completed').length;
        const inProgress = filtered.filter((item) => item.status === 'in_progress').length;
        const pending = filtered.filter((item) => item.status === 'pending').length;
        const cancelled = weekItems.filter((item) => item.status === 'cancelled').length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
            total,
            completed,
            inProgress,
            pending,
            cancelled,
            remaining: Math.max(total - completed, 0),
            completionRate,
            maxValue: Math.max(completed, inProgress, pending, cancelled, 1)
        };
    }, [weekItems]);

    const dailyCounts = useMemo(() => {
        const { start } = getWeekRange();
        const days = [];
        for (let i = 0; i < 7; i += 1) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const ymd = toYmd(date);
            const itemsForDay = weekItems.filter((item) => item.date === ymd && item.status !== 'cancelled');
            const completedForDay = itemsForDay.filter((item) => item.status === 'completed').length;
            const completionRate = itemsForDay.length > 0
                ? Math.round((completedForDay / itemsForDay.length) * 100)
                : 0;
            days.push({
                date: ymd,
                label: date.toLocaleDateString(undefined, { weekday: 'short' }),
                count: itemsForDay.length,
                completed: completedForDay,
                completionRate
            });
        }
        return days;
    }, [weekItems]);

    const weeklyTotals = weeklyAnalytics?.totals || {};
    const weeklyFocusMinutes = weeklyTotals.focus_time_spent_minutes || 0;
    const weeklyFocusSessions = weeklyTotals.focus_sessions_count || 0;
    const weeklyFocusSuccessRate = weeklyTotals.focus_sessions_total
        ? Math.round((weeklyTotals.focus_sessions_completed / weeklyTotals.focus_sessions_total) * 100)
        : 0;

    const badgeFor = (status) => ({
        label: STATUS_LABELS[status] || titleCase((status || '').replace('_', ' ')),
        className: STATUS_BADGE_CLASSES[status] || 'status-upcoming'
    });

    const isInitialLoading = loading && weekItems.length === 0 && !weeklyAnalytics;

    return (
        <div className="week-container">
            <div className="week-header">
                <div className="week-header-top">
                    <div>
                        <h1>Week Dashboard</h1>
                        <p className="week-subtitle">Your weekly progress — this week&apos;s tasks and routines, grouped by category.</p>
                    </div>
                    <div className="week-actions">
                        <Button variant="secondary" onClick={() => navigate('/tasks')}>Task List</Button>
                        <Button variant="secondary" onClick={() => navigate('/routines')}>Daily Routines</Button>
                        <Button variant="secondary" onClick={() => navigate('/analytics')}>Analytics</Button>
                    </div>
                </div>

                <div className="week-hero">
                    <div className="stats">
                        <div className="week-range-line">
                            <span className="stat-label">Week Range</span>
                            <strong>{startYmd} → {endYmd}</strong>
                        </div>
                        <div className="stat-row">
                            <div className="stat-item">
                                <span className="stat-value">{weeklyStats.completed}</span>
                                <span className="stat-label">Completed</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{weeklyStats.remaining}</span>
                                <span className="stat-label">Remaining</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{weeklyStats.total}</span>
                                <span className="stat-label">Total tasks</span>
                            </div>
                        </div>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${weeklyStats.completionRate}%` }}></div>
                        </div>
                        <div className="stat-row stat-row--focus">
                            <div className="stat-item">
                                <span className="stat-value">{weeklyFocusMinutes}<small> min</small></span>
                                <span className="stat-label">Focus · {weeklyFocusSessions} session(s)</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">{weeklyFocusSuccessRate}%</span>
                                <span className="stat-label">Focus success</span>
                            </div>
                        </div>
                    </div>

                    <div className="week-chart">
                        <div className="chart-header">
                            <div>
                                <h3>Weekly Task Breakdown</h3>
                                <p>Completed vs in progress vs pending vs cancelled</p>
                            </div>
                            <span className="chart-total">{weeklyStats.total} tasks</span>
                        </div>
                        <div className="chart-bars">
                            <div className="chart-bar">
                                <span className="chart-bar-fill chart-bar-completed" style={{ height: `${(weeklyStats.completed / weeklyStats.maxValue) * 100}%` }}></span>
                                <span className="chart-bar-label">Completed</span>
                                <span className="chart-bar-value">{weeklyStats.completed}</span>
                            </div>
                            <div className="chart-bar">
                                <span className="chart-bar-fill chart-bar-review" style={{ height: `${(weeklyStats.inProgress / weeklyStats.maxValue) * 100}%` }}></span>
                                <span className="chart-bar-label">In Progress</span>
                                <span className="chart-bar-value">{weeklyStats.inProgress}</span>
                            </div>
                            <div className="chart-bar">
                                <span className="chart-bar-fill chart-bar-upcoming" style={{ height: `${(weeklyStats.pending / weeklyStats.maxValue) * 100}%` }}></span>
                                <span className="chart-bar-label">Pending</span>
                                <span className="chart-bar-value">{weeklyStats.pending}</span>
                            </div>
                            <div className="chart-bar">
                                <span className="chart-bar-fill chart-bar-incomplete" style={{ height: `${(weeklyStats.cancelled / weeklyStats.maxValue) * 100}%` }}></span>
                                <span className="chart-bar-label">Cancelled</span>
                                <span className="chart-bar-value">{weeklyStats.cancelled}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && <p className="week-error">{error}</p>}

            {isInitialLoading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : (
                <>
                    <section className="week-strip-card">
                        <div className="week-panel-header">
                            <h2>Daily Completion</h2>
                            <span className="muted">This week</span>
                        </div>
                        <div className="week-strip">
                            {dailyCounts.map((day) => (
                                <div key={day.date} className="week-strip-item">
                                    <span>{day.label}</span>
                                    <div className="week-strip-meta">
                                        <strong>{day.count}</strong>
                                        <small>{day.completed}/{day.count || 0} · {day.completionRate}%</small>
                                    </div>
                                    <div className="week-strip-bar">
                                        <span style={{ width: `${day.completionRate}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="week-strip-card">
                        <div className="week-panel-header">
                            <h2>Weekly Productivity Trends</h2>
                            <span className="muted">Last 7 days</span>
                        </div>
                        {weeklyTrends.length === 0 ? (
                            <p className="muted">No trend data yet.</p>
                        ) : (
                            <div className="week-trend-grid">
                                {weeklyTrends.slice(-7).map((trend) => (
                                    <div key={trend.date} className="week-trend-card">
                                        <span className="muted">{trend.date}</span>
                                        <strong>{trend.completed_tasks}/{trend.total_tasks}</strong>
                                        <div className="week-trend-bar">
                                            <span style={{ width: `${Math.min(100, Math.round(trend.completion_rate || 0))}%` }} />
                                        </div>
                                        <small>{Number(trend.completion_rate || 0).toFixed(1)}% · {trend.time_spent_hours}h</small>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <div className="week-lists">
                        <div className="week-list-column">
                            <div className="week-list-heading">
                                <h2>Tasks by Category</h2>
                                <span className="muted">{weekItems.length} tasks</span>
                            </div>
                            {tasksByCategory.length === 0 ? (
                                <p className="muted">No tasks scheduled for this week.</p>
                            ) : (
                                tasksByCategory.map((group) => (
                                    <TaskSection
                                        key={group.category}
                                        title={group.category}
                                        count={group.items.length}
                                        emptyText="No tasks in this category."
                                    >
                                        {group.items.map((item) => (
                                            <TaskCard
                                                key={item.key}
                                                item={item}
                                                variant={item.status === 'completed' ? 'completed' : 'upcoming'}
                                                badge={badgeFor(item.status)}
                                                routineName={item.isRoutine ? 'Routine' : null}
                                            />
                                        ))}
                                    </TaskSection>
                                ))
                            )}
                        </div>

                        <div className="week-list-column">
                            <div className="week-list-heading">
                                <h2>Routines by Type</h2>
                                <span className="muted">{routines.length} routines</span>
                            </div>
                            {routinesByType.length === 0 ? (
                                <p className="muted">No routines available yet.</p>
                            ) : (
                                routinesByType.map((group) => (
                                    <TaskSection
                                        key={group.type}
                                        title={titleCase(group.type)}
                                        count={group.items.length}
                                        emptyText="No routines of this type."
                                    >
                                        {group.items.map((routine) => (
                                            <div key={routine.id} className="task-item task-item--anytime">
                                                <div className="task-content">
                                                    <div className="task-title-row">
                                                        <h3 className="task-title">{routine.name}</h3>
                                                        <span className={`task-status-badge ${routine.is_active ? 'status-completed' : 'status-missed'}`}>
                                                            {routine.is_active ? 'Active' : 'Paused'}
                                                        </span>
                                                    </div>
                                                    {routine.description && (
                                                        <p className="task-description">{routine.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </TaskSection>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default WeekView;
