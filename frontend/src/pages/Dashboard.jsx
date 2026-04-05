import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useTasks } from '../context/TaskContext';
import taskService from '../services/taskService';
import analyticsService from '../services/analyticsService';
import './Dashboard.css';

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

const formatClock = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const formatElapsed = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const hh = Math.floor(safe / 3600);
    const mm = Math.floor((safe % 3600) / 60);
    const ss = safe % 60;
    return `${`${hh}`.padStart(2, '0')}:${`${mm}`.padStart(2, '0')}:${`${ss}`.padStart(2, '0')}`;
};

const displayTaskDateTime = (task) => {
    if (!task?.scheduled_date) return 'Unscheduled';
    return `${task.scheduled_date}${task.scheduled_time ? ` • ${toHm(task.scheduled_time)}` : ''}`;
};

const Dashboard = () => {
    const { tasks, fetchTasks, createDaySchedule } = useTasks();

    const [now, setNow] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [upcomingTasks, setUpcomingTasks] = useState([]);
    const [loadingUpcoming, setLoadingUpcoming] = useState(false);
    const [dashboardError, setDashboardError] = useState('');

    const [focusEnabled, setFocusEnabled] = useState(false);
    const [focusDurationMinutes, setFocusDurationMinutes] = useState(50);
    const [focusStartedAt, setFocusStartedAt] = useState(null);
    const [elapsedFocusSeconds, setElapsedFocusSeconds] = useState(0);
    const [focusError, setFocusError] = useState('');
    const [focusMessage, setFocusMessage] = useState('');
    const [savingFocusSession, setSavingFocusSession] = useState(false);

    const [focusPatterns, setFocusPatterns] = useState({
        todayMinutes: 0,
        todaySessions: 0,
        avgDailyMinutes: 0,
        avgSessionsPerDay: 0,
        bestDay: null
    });

    const todayYmd = useMemo(() => toYmd(new Date()), []);
    const selectedYmd = useMemo(() => toYmd(selectedDate), [selectedDate]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const loadDashboardData = useCallback(async () => {
        try {
            setDashboardError('');
            await fetchTasks();

            setLoadingUpcoming(true);
            const upcomingResponse = await taskService.getUpcomingTasks();
            const normalizedUpcoming = (upcomingResponse?.data?.tasks || [])
                .filter((task) => ['pending', 'in_progress'].includes(task.status))
                .slice(0, 3);
            setUpcomingTasks(normalizedUpcoming);
        } catch (error) {
            setDashboardError(error?.message || 'Failed to load dashboard data');
        } finally {
            setLoadingUpcoming(false);
        }
    }, [fetchTasks]);

    const loadFocusPatterns = useCallback(async () => {
        try {
            const response = await analyticsService.getFocusPatterns(14);
            const data = response?.data || {};
            const daily = data.daily || [];
            const today = daily.find((item) => item.date === todayYmd) || null;

            setFocusPatterns({
                todayMinutes: today?.focus_time_spent_minutes || 0,
                todaySessions: today?.focus_sessions_count || 0,
                avgDailyMinutes: data.avg_daily_focus_minutes || 0,
                avgSessionsPerDay: data.avg_sessions_per_day || 0,
                bestDay: data.best_focus_day?.date ? data.best_focus_day : null
            });
        } catch {
            // Non-blocking: focus metrics panel can stay with defaults.
            setFocusPatterns({
                todayMinutes: 0,
                todaySessions: 0,
                avgDailyMinutes: 0,
                avgSessionsPerDay: 0,
                bestDay: null
            });
        }
    }, [todayYmd]);

    useEffect(() => {
        loadDashboardData();
        loadFocusPatterns();
    }, [loadDashboardData, loadFocusPatterns]);

    useEffect(() => {
        if (!focusStartedAt) return undefined;

        const interval = setInterval(() => {
            setElapsedFocusSeconds(Math.max(0, Math.floor((Date.now() - focusStartedAt) / 1000)));
        }, 1000);

        return () => clearInterval(interval);
    }, [focusStartedAt]);

    const selectedDateTaskCount = useMemo(() => (
        tasks.filter((task) => task.scheduled_date === selectedYmd).length
    ), [selectedYmd, tasks]);

    const selectedDateTaskPreview = useMemo(() => (
        tasks
            .filter((task) => task.scheduled_date === selectedYmd)
            .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))
            .slice(0, 3)
    ), [selectedYmd, tasks]);

    const projectedEndTime = useMemo(() => {
        if (!focusStartedAt || !focusEnabled) return null;
        const endTimestamp = focusStartedAt + (Math.max(1, Number(focusDurationMinutes) || 1) * 60 * 1000);
        return new Date(endTimestamp);
    }, [focusDurationMinutes, focusEnabled, focusStartedAt]);

    const handleScheduleTomorrow = async () => {
        setDashboardError('');

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowYmd = toYmd(tomorrow);

        const sourceTasks = tasks
            .filter((task) => task.scheduled_date === todayYmd && ['pending', 'in_progress'].includes(task.status));

        if (sourceTasks.length === 0) {
            setDashboardError('No pending or in-progress tasks from today to schedule for tomorrow.');
            return;
        }

        const slots = sourceTasks.map((task) => ({
            title: task.title,
            start_time: toHm(task.scheduled_time),
            priority: task.priority || 'medium',
            category: task.category || '',
            description: task.description || '',
            duration_minutes: task.duration_minutes || null
        }));

        try {
            await createDaySchedule({
                date: tomorrowYmd,
                slots,
                replaceExisting: false
            });
            await loadDashboardData();
            setDashboardError('');
            setFocusMessage(`Scheduled ${slots.length} task(s) for tomorrow (${tomorrowYmd}).`);
        } catch (error) {
            const validationMessage = error?.errors?.[0]?.message;
            setDashboardError(validationMessage || error?.message || 'Failed to schedule tasks for tomorrow.');
        }
    };

    const startFocusMode = () => {
        setFocusError('');
        setFocusMessage('');
        setFocusStartedAt(Date.now());
        setElapsedFocusSeconds(0);
    };

    const stopFocusMode = async () => {
        if (!focusStartedAt) {
            setFocusStartedAt(null);
            setElapsedFocusSeconds(0);
            return;
        }

        const durationSeconds = Math.max(0, Math.floor((Date.now() - focusStartedAt) / 1000));
        const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));
        const start = new Date(focusStartedAt);
        const end = new Date();

        setSavingFocusSession(true);
        setFocusError('');

        try {
            await analyticsService.logFocusSession({
                date: toYmd(start),
                start_time: `${`${start.getHours()}`.padStart(2, '0')}:${`${start.getMinutes()}`.padStart(2, '0')}:${`${start.getSeconds()}`.padStart(2, '0')}`,
                end_time: `${`${end.getHours()}`.padStart(2, '0')}:${`${end.getMinutes()}`.padStart(2, '0')}:${`${end.getSeconds()}`.padStart(2, '0')}`,
                duration_minutes: durationMinutes
            });
            await loadFocusPatterns();
            setFocusMessage(`Great focus sprint! Logged ${durationMinutes} minute(s).`);
        } catch (error) {
            setFocusError(error?.message || 'Could not save focus session.');
        } finally {
            setSavingFocusSession(false);
            setFocusStartedAt(null);
            setElapsedFocusSeconds(0);
        }
    };

    const toggleFocusEnabled = (event) => {
        const enabled = event.target.checked;
        setFocusEnabled(enabled);

        if (!enabled && focusStartedAt) {
            setFocusStartedAt(null);
            setElapsedFocusSeconds(0);
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header-row">
                <h1>Dashboard</h1>
                <div className="dashboard-live-clock card">
                    <p className="clock-date">
                        {now.toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </p>
                    <p className="clock-time">{formatClock(now)}</p>
                </div>
            </div>

            {dashboardError && <p className="dashboard-error">{dashboardError}</p>}

            <section className="dashboard-calendar card">
                <div className="dashboard-section-header">
                    <h2>Calendar</h2>
                    <button className="btn btn-primary" type="button" onClick={handleScheduleTomorrow}>
                        Schedule Tomorrow
                    </button>
                </div>

                <div className="dashboard-calendar-grid">
                    <Calendar
                        onChange={(value) => setSelectedDate(value instanceof Date ? value : new Date())}
                        value={selectedDate}
                    />
                    <div className="calendar-insight-card">
                        <p className="calendar-selected-date">Selected: <strong>{selectedYmd}</strong></p>
                        <p className="muted">Tasks planned: <strong>{selectedDateTaskCount}</strong></p>

                        <div className="calendar-task-preview">
                            {selectedDateTaskPreview.length === 0 ? (
                                <p className="muted">No tasks on this date.</p>
                            ) : (
                                selectedDateTaskPreview.map((task) => (
                                    <div key={task.id} className="calendar-task-preview-item">
                                        <span>{task.title}</span>
                                        <small>{toHm(task.scheduled_time) || 'Any time'}</small>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="dashboard-card upcoming-card">
                <div className="dashboard-section-header">
                    <h2>Upcoming Tasks</h2>
                    <span className="muted">Next 2–3 tasks</span>
                </div>

                {loadingUpcoming ? (
                    <p className="muted">Loading upcoming tasks...</p>
                ) : upcomingTasks.length === 0 ? (
                    <p className="muted">No upcoming tasks found for the next week.</p>
                ) : (
                    <ul className="upcoming-list">
                        {upcomingTasks.map((task) => (
                            <li key={task.id}>
                                <div>
                                    <p className="upcoming-title">{task.title}</p>
                                    <p className="upcoming-meta">{displayTaskDateTime(task)}</p>
                                </div>
                                <span className={`task-priority priority-${task.priority || 'medium'}`}>
                                    {task.priority || 'medium'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="dashboard-card focus-card">
                <div className="dashboard-section-header">
                    <h2>Focus Mode</h2>
                    <label className="focus-toggle">
                        <input type="checkbox" checked={focusEnabled} onChange={toggleFocusEnabled} />
                        Enable
                    </label>
                </div>

                {!focusEnabled ? (
                    <p className="muted">Enable focus mode to track your work sessions and improve time awareness.</p>
                ) : (
                    <>
                        <div className="focus-settings-row">
                            <label htmlFor="focus-duration" className="muted">Session target (minutes)</label>
                            <input
                                id="focus-duration"
                                className="input focus-duration-input"
                                type="number"
                                min="1"
                                max="240"
                                value={focusDurationMinutes}
                                onChange={(e) => setFocusDurationMinutes(e.target.value)}
                                disabled={Boolean(focusStartedAt)}
                            />
                        </div>

                        <div className="focus-live-box">
                            <p className="focus-timer">{formatElapsed(elapsedFocusSeconds)}</p>
                            <p className="muted">
                                Ending time:{' '}
                                <strong>{projectedEndTime ? projectedEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</strong>
                            </p>
                        </div>

                        <div className="focus-actions">
                            {!focusStartedAt ? (
                                <button className="btn btn-primary" type="button" onClick={startFocusMode}>
                                    Start Focus
                                </button>
                            ) : (
                                <button className="btn btn-danger" type="button" onClick={stopFocusMode} disabled={savingFocusSession}>
                                    {savingFocusSession ? 'Saving...' : 'Stop Focus'}
                                </button>
                            )}
                        </div>

                        {focusError && <p className="dashboard-error">{focusError}</p>}
                        {focusMessage && <p className="muted">{focusMessage}</p>}

                        <div className="focus-insights-grid">
                            <div>
                                <span className="profile-label">Today Focus</span>
                                <p>{focusPatterns.todayMinutes} min ({focusPatterns.todaySessions} sessions)</p>
                            </div>
                            <div>
                                <span className="profile-label">14-day Average</span>
                                <p>{focusPatterns.avgDailyMinutes.toFixed(1)} min/day</p>
                            </div>
                            <div>
                                <span className="profile-label">Avg Sessions/Day</span>
                                <p>{focusPatterns.avgSessionsPerDay.toFixed(2)}</p>
                            </div>
                            <div>
                                <span className="profile-label">Best Focus Day</span>
                                <p>
                                    {focusPatterns.bestDay
                                        ? `${focusPatterns.bestDay.date} (${focusPatterns.bestDay.focus_time_spent_minutes} min)`
                                        : 'No data yet'}
                                </p>
                            </div>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

export default Dashboard;
