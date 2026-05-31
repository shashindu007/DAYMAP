import React, { useCallback, useEffect, useMemo, useState } from 'react';
import taskService from '../services/taskService';
import routineService from '../services/routineService';
import scheduleService from '../services/scheduleService';
import analyticsService from '../services/analyticsService';
import './WeekView.css';

const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toHm = (timeValue) => {
    if (!timeValue || typeof timeValue !== 'string') return '';
    return timeValue.slice(0, 5);
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

const WeekView = () => {
    const [weekTasks, setWeekTasks] = useState([]);
    const [routines, setRoutines] = useState([]);
    const [weekRange, setWeekRange] = useState({ start: '', end: '' });
    const [weeklyAnalytics, setWeeklyAnalytics] = useState(null);
    const [weeklyTrends, setWeeklyTrends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadWeekData = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const { startYmd, endYmd } = getWeekRange();

            const [tasksResponse, scheduleResponse, routinesResponse, weeklyResponse, trendsResponse] = await Promise.all([
                taskService.getWeekTasks(),
                scheduleService.getScheduleRange(startYmd, endYmd),
                routineService.getAllRoutines(),
                analyticsService.getWeeklyAnalytics(startYmd, endYmd),
                analyticsService.getTrends(7)
            ]);

            const taskPayload = tasksResponse?.data?.data || tasksResponse?.data || tasksResponse;
            const taskList = taskPayload?.tasks || taskPayload?.data?.tasks || [];

            const schedulePayload = scheduleResponse?.data?.data || scheduleResponse?.data || scheduleResponse;
            const scheduleList = schedulePayload?.tasks || schedulePayload?.data?.tasks || schedulePayload || [];

            const normalizedScheduleTasks = scheduleList.map((task) => ({
                ...task,
                scheduled_time: task.slot_start_time || task.scheduled_time || null,
                source: 'schedule'
            }));

            const normalizedTaskList = taskList.map((task) => ({
                ...task,
                source: 'task'
            }));

            setWeekTasks([...normalizedScheduleTasks, ...normalizedTaskList]);
            setWeekRange({
                start: startYmd,
                end: endYmd
            });

            const routinePayload = routinesResponse?.data?.data || routinesResponse?.data || routinesResponse;
            setRoutines(routinePayload?.routines || routinePayload?.data?.routines || []);

            const weeklyPayload = weeklyResponse?.data?.data || weeklyResponse?.data || weeklyResponse;
            setWeeklyAnalytics(weeklyPayload?.data || weeklyPayload);

            const trendsPayload = trendsResponse?.data?.data || trendsResponse?.data || trendsResponse;
            setWeeklyTrends(trendsPayload?.trends || trendsPayload?.data?.trends || []);
        } catch (loadError) {
            setError(loadError?.message || 'Failed to load weekly data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadWeekData();
    }, [loadWeekData]);

    useEffect(() => {
        const interval = setInterval(() => {
            loadWeekData();
        }, 30000);
        return () => clearInterval(interval);
    }, [loadWeekData]);

    const tasksByCategory = useMemo(() => {
        const grouped = new Map();
        weekTasks.forEach((task) => {
            const key = task.category?.trim() || 'Uncategorized';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(task);
        });

        return Array.from(grouped.entries())
            .map(([category, items]) => ({
                category,
                items: items.sort((a, b) => {
                    const dateCompare = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
                    if (dateCompare !== 0) return dateCompare;
                    return (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
                })
            }))
            .sort((a, b) => a.category.localeCompare(b.category));
    }, [weekTasks]);

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
        const filtered = weekTasks.filter((task) => task.status !== 'cancelled');
        const total = filtered.length;
        const completed = filtered.filter((task) => task.status === 'completed').length;
        const inProgress = filtered.filter((task) => task.status === 'in_progress').length;
        const pending = filtered.filter((task) => task.status === 'pending').length;
        const cancelled = weekTasks.filter((task) => task.status === 'cancelled').length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, inProgress, pending, cancelled, completionRate };
    }, [weekTasks]);

    const dailyCounts = useMemo(() => {
        const { start } = getWeekRange();
        const days = [];
        for (let i = 0; i < 7; i += 1) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const ymd = toYmd(date);
            const tasksForDay = weekTasks.filter((task) => task.scheduled_date === ymd && task.status !== 'cancelled');
            const completedForDay = tasksForDay.filter((task) => task.status === 'completed').length;
            const completionRate = tasksForDay.length > 0
                ? Math.round((completedForDay / tasksForDay.length) * 100)
                : 0;
            days.push({
                date: ymd,
                label: date.toLocaleDateString(undefined, { weekday: 'short' }),
                count: tasksForDay.length,
                completed: completedForDay,
                completionRate
            });
        }
        return days;
    }, [weekTasks]);

    const weeklyTotals = weeklyAnalytics?.totals || {};
    const weeklyFocusMinutes = weeklyTotals.focus_time_spent_minutes || 0;
    const weeklyFocusSessions = weeklyTotals.focus_sessions_count || 0;
    const weeklyFocusSuccessRate = weeklyTotals.focus_sessions_total
        ? Math.round((weeklyTotals.focus_sessions_completed / weeklyTotals.focus_sessions_total) * 100)
        : 0;

    if (loading) {
        return (
            <div className="week-container">
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="week-container">
            <div className="week-header">
                <div>
                    <h1>Week Dashboard</h1>
                    <p className="muted">All tasks and routines from the past week, neatly grouped by category.</p>
                </div>
                <div className="week-range card">
                    <span className="profile-label">Week Range</span>
                    <p>{weekRange.start || '—'} → {weekRange.end || '—'}</p>
                </div>
            </div>

            {error && <p className="week-error">{error}</p>}

            <section className="week-summary card">
                <div className="week-summary-grid">
                    <div className="week-summary-card">
                        <span className="profile-label">Total Tasks</span>
                        <p>{weeklyStats.total}</p>
                        <small className="muted">{weeklyStats.cancelled} cancelled</small>
                    </div>
                    <div className="week-summary-card">
                        <span className="profile-label">Completed</span>
                        <p>{weeklyStats.completed}</p>
                        <div className="week-progress">
                            <span style={{ width: `${weeklyStats.completionRate}%` }} />
                        </div>
                        <small className="muted">{weeklyStats.completionRate}% done</small>
                    </div>
                    <div className="week-summary-card">
                        <span className="profile-label">In Progress</span>
                        <p>{weeklyStats.inProgress}</p>
                        <small className="muted">Active momentum</small>
                    </div>
                    <div className="week-summary-card">
                        <span className="profile-label">Pending</span>
                        <p>{weeklyStats.pending}</p>
                        <small className="muted">Needs attention</small>
                    </div>
                    <div className="week-summary-card accent">
                        <span className="profile-label">Focus Minutes</span>
                        <p>{weeklyFocusMinutes} min</p>
                        <small className="muted">{weeklyFocusSessions} session(s)</small>
                    </div>
                    <div className="week-summary-card accent">
                        <span className="profile-label">Focus Success</span>
                        <p>{weeklyFocusSuccessRate}%</p>
                        <small className="muted">Weekly rate</small>
                    </div>
                </div>

                <div className="week-strip">
                    {dailyCounts.map((day) => (
                        <div key={day.date} className="week-strip-item">
                            <span>{day.label}</span>
                            <div className="week-strip-meta">
                                <strong>{day.count}</strong>
                                <small>{day.completed}/{day.count || 0} · {day.completionRate}%</small>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="week-insights card">
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

            <div className="week-grid">
                <section className="week-panel card">
                    <div className="week-panel-header">
                        <h2>Tasks by Category</h2>
                        <span className="muted">{weekTasks.length} tasks</span>
                    </div>

                    {tasksByCategory.length === 0 ? (
                        <p className="muted">No tasks scheduled for the past week.</p>
                    ) : (
                        <div className="week-category-grid">
                            {tasksByCategory.map((group) => (
                                <div key={group.category} className="week-category-card">
                                    <div className="week-category-header">
                                        <h3>{group.category}</h3>
                                        <span className="muted">{group.items.length}</span>
                                    </div>
                                    <div className="week-category-list">
                                        {group.items.map((task) => (
                                            <div key={task.id} className="week-task-item">
                                                <div>
                                                    <p className="week-task-title">{task.title}</p>
                                                    <p className="muted">{task.scheduled_date || 'Unscheduled'} {toHm(task.scheduled_time) && `• ${toHm(task.scheduled_time)}`}</p>
                                                </div>
                                                <div className="week-task-meta">
                                                    <span className={`status-badge status-${task.status}`}>{titleCase(task.status?.replace('_', ' ') || '')}</span>
                                                    <span className={`task-priority priority-${task.priority || 'medium'}`}>{task.priority || 'medium'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="week-panel card">
                    <div className="week-panel-header">
                        <h2>Routines by Type</h2>
                        <span className="muted">{routines.length} routines</span>
                    </div>

                    {routinesByType.length === 0 ? (
                        <p className="muted">No routines available yet.</p>
                    ) : (
                        <div className="week-category-grid">
                            {routinesByType.map((group) => (
                                <div key={group.type} className="week-category-card">
                                    <div className="week-category-header">
                                        <h3>{titleCase(group.type)}</h3>
                                        <span className="muted">{group.items.length}</span>
                                    </div>
                                    <div className="week-category-list">
                                        {group.items.map((routine) => (
                                            <div key={routine.id} className="week-task-item">
                                                <div>
                                                    <p className="week-task-title">{routine.name}</p>
                                                    <p className="muted">{routine.description || 'No description yet'}</p>
                                                </div>
                                                <div className="week-task-meta">
                                                    <span className={`status-badge ${routine.is_active ? 'status-active' : 'status-paused'}`}>
                                                        {routine.is_active ? 'Active' : 'Paused'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default WeekView;
