import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import taskService from '../services/taskService';
import routineService from '../services/routineService';
import scheduleService from '../services/scheduleService';
import analyticsService from '../services/analyticsService';
import Button from '../components/common/Button';
import TaskCard from '../components/tasks/TaskCard';
import { normalizeDayItem, sortByStart } from '../utils/dayItems';
import { activeDaysFor } from '../utils/routineDays';
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
    const todayYmd = useMemo(() => toYmd(new Date()), []);
    const cacheKey = `${startYmd}:${endYmd}`;
    const seeded = weekCache && weekCache.key === cacheKey ? weekCache.payload : null;

    const [weekItems, setWeekItems] = useState(seeded?.weekItems || []);
    const [routines, setRoutines] = useState(seeded?.routines || []);
    const [weeklyAnalytics, setWeeklyAnalytics] = useState(seeded?.weeklyAnalytics || null);
    const [loading, setLoading] = useState(!seeded);
    const [error, setError] = useState('');

    const loadWeekData = useCallback(async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true);
            setError('');

            const [tasksResponse, scheduleResponse, routinesResponse, weeklyResponse] = await Promise.all([
                taskService.getWeekTasks(startYmd, endYmd),
                // Read-only: the week summary only displays schedule tasks, it
                // must not trigger the per-day routine materialization writes.
                scheduleService.getScheduleRange(startYmd, endYmd, { materialize: false }),
                routineService.getAllRoutines(),
                analyticsService.getWeeklyAnalytics(startYmd, endYmd)
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

            // The calendar date is what the page groups by, so carry it on each
            // item. It no longer gets glued onto startLabel — every card now
            // sits under a row that already names its day.
            const withDates = [...normalizedScheduleItems, ...normalizedTaskItems].map((item) => ({
                ...item,
                date: item.raw?.scheduled_date || null
            }));

            const nextRoutinePayload = routinesResponse?.data?.data || routinesResponse?.data || routinesResponse;
            const nextRoutines = nextRoutinePayload?.routines || nextRoutinePayload?.data?.routines || [];

            const weeklyPayload = weeklyResponse?.data?.data || weeklyResponse?.data || weeklyResponse;
            const nextWeeklyAnalytics = weeklyPayload?.data || weeklyPayload;

            setWeekItems(withDates);
            setRoutines(nextRoutines);
            setWeeklyAnalytics(nextWeeklyAnalytics);

            weekCache = {
                key: cacheKey,
                payload: {
                    weekItems: withDates,
                    routines: nextRoutines,
                    weeklyAnalytics: nextWeeklyAnalytics
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

    /**
     * One row per day of the week, each holding that day's tasks and routines.
     *
     * The page used to split into two side-by-side columns — tasks grouped by
     * category on the left, routine templates grouped by recurrence type on the
     * right — so answering "what does Tuesday look like?" meant reading both
     * columns and matching dates by eye.
     *
     * Routines appear twice over in the data: as materialized schedule items
     * (item.isRoutine) once a day has been generated, and as a template that
     * merely *will* run on that weekday. Days ahead of materialization would
     * otherwise look empty, so unmaterialized templates render as "Planned" —
     * deduped against the templates that already produced an item that day.
     */
    const daySections = useMemo(() => {
        const { start } = getWeekRange();
        const itemsByDate = new Map();
        weekItems.forEach((item) => {
            if (!item.date) return;
            if (!itemsByDate.has(item.date)) itemsByDate.set(item.date, []);
            itemsByDate.get(item.date).push(item);
        });

        const days = [];
        for (let i = 0; i < 7; i += 1) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            const ymd = toYmd(date);
            const dayItems = itemsByDate.get(ymd) || [];

            const tasks = dayItems.filter((item) => !item.isRoutine).sort(sortByStart);
            const routineItems = dayItems.filter((item) => item.isRoutine).sort(sortByStart);

            const materializedTemplates = new Set(
                routineItems.map((item) => item.raw?.routine_template_id).filter(Boolean)
            );
            const plannedRoutines = routines
                .filter((routine) => (
                    routine.is_active !== false
                    && activeDaysFor(routine.recurrence).includes(date.getDay())
                    && !materializedTemplates.has(routine.id)
                ))
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            const tracked = dayItems.filter((item) => item.status !== 'cancelled');
            const completed = tracked.filter((item) => item.status === 'completed').length;

            days.push({
                date: ymd,
                weekdayLabel: date.toLocaleDateString(undefined, { weekday: 'long' }),
                dateLabel: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                isToday: ymd === todayYmd,
                tasks,
                routineItems,
                plannedRoutines,
                total: tracked.length,
                completed,
                isEmpty: dayItems.length === 0 && plannedRoutines.length === 0
            });
        }
        return days;
    }, [weekItems, routines, todayYmd]);

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
                        <p className="week-subtitle">Your weekly progress — this week&apos;s tasks and routines, day by day.</p>
                    </div>
                    <div className="week-actions">
                        <Button variant="secondary" onClick={() => navigate('/analytics')}>View Analytics</Button>
                    </div>
                </div>

                {/* Three numbers and a bar. The hero used to carry six numbers
                    plus a four-bar chart restating the same completion split. */}
                <div className="stats">
                    <div className="week-range-line">
                        <span className="stat-label">Week range</span>
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
                            <span className="stat-value">{weeklyStats.completionRate}%</span>
                            <span className="stat-label">Completion</span>
                        </div>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-fill progress-fill--success"
                            style={{ width: `${weeklyStats.completionRate}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {error && <p className="alert alert-error">{error}</p>}

            {isInitialLoading ? (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            ) : (
                <>
                    {/* The one weekly visualization. "Weekly Productivity
                        Trends" used to sit directly below this showing the same
                        seven days over again. */}
                    <section className="week-strip-card">
                        <div className="week-panel-header">
                            <h2>Daily completion</h2>
                            <span className="muted">
                                {weeklyFocusMinutes} min focus · {weeklyFocusSessions} session{weeklyFocusSessions === 1 ? '' : 's'} · {weeklyFocusSuccessRate}% success
                            </span>
                        </div>
                        <div className="week-strip">
                            {dailyCounts.map((day) => (
                                <div
                                    key={day.date}
                                    className={`week-strip-item ${day.date === todayYmd ? 'week-strip-item--today' : ''}`}
                                >
                                    <span className="week-strip-day">{day.label}</span>
                                    <div className="week-strip-meta">
                                        <strong>{day.completed}</strong>
                                        <small>/{day.count}</small>
                                    </div>
                                    <div className="week-strip-bar">
                                        <span style={{ width: `${day.completionRate}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* One row per day — tasks and routines together, in date
                        order, instead of two columns you had to cross-reference. */}
                    <div className="week-days">
                        {daySections.map((day) => (
                            <section
                                key={day.date}
                                className={`week-day ${day.isToday ? 'week-day--today' : ''}`}
                            >
                                <header className="week-day-header">
                                    <div className="week-day-title">
                                        <h2>{day.weekdayLabel}</h2>
                                        <span className="week-day-date">{day.dateLabel}</span>
                                        {day.isToday && <span className="week-day-flag">Today</span>}
                                    </div>
                                    <span className="muted">
                                        {day.total > 0
                                            ? `${day.completed}/${day.total} done`
                                            : 'Nothing scheduled'}
                                    </span>
                                </header>

                                {day.isEmpty ? (
                                    <p className="week-day-empty">No tasks or routines on this day.</p>
                                ) : (
                                    <div className="week-day-body">
                                        {day.tasks.length > 0 && (
                                            <div className="week-day-group">
                                                <h3 className="week-day-group-label">
                                                    Tasks <span>{day.tasks.length}</span>
                                                </h3>
                                                {day.tasks.map((item) => (
                                                    <TaskCard
                                                        key={item.key}
                                                        item={item}
                                                        variant={item.status === 'completed' ? 'completed' : 'upcoming'}
                                                        badge={badgeFor(item.status)}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {(day.routineItems.length > 0 || day.plannedRoutines.length > 0) && (
                                            <div className="week-day-group">
                                                <h3 className="week-day-group-label">
                                                    Routines <span>{day.routineItems.length + day.plannedRoutines.length}</span>
                                                </h3>
                                                {day.routineItems.map((item) => (
                                                    <TaskCard
                                                        key={item.key}
                                                        item={item}
                                                        variant={item.status === 'completed' ? 'completed' : 'upcoming'}
                                                        badge={badgeFor(item.status)}
                                                        routineName="Routine"
                                                    />
                                                ))}
                                                {day.plannedRoutines.map((routine) => (
                                                    <div
                                                        key={`${day.date}:${routine.id}`}
                                                        className="task-item task-item--anytime"
                                                    >
                                                        <div className="task-content">
                                                            <div className="task-title-row">
                                                                <h3 className="task-title">
                                                                    {routine.icon && (
                                                                        <span aria-hidden>{routine.icon} </span>
                                                                    )}
                                                                    {routine.name}
                                                                </h3>
                                                                {/* Neutral badge: this day has not been
                                                                    generated yet, so there is no status
                                                                    to report — only an intent. */}
                                                                <span className="task-status-badge status-anytime">Planned</span>
                                                            </div>
                                                            {routine.description && (
                                                                <p className="task-description">{routine.description}</p>
                                                            )}
                                                            <div className="task-meta">
                                                                <span className="task-badge-routine">
                                                                    {titleCase(routine.recurrence?.type || 'daily')}
                                                                </span>
                                                                {routine.items?.length > 0 && (
                                                                    <span className="task-duration">
                                                                        {routine.items.length} step{routine.items.length === 1 ? '' : 's'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default WeekView;
