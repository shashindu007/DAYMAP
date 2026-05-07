import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
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

const DEFAULT_FOCUS_DURATION_MINUTES = 50;
const MIN_FOCUS_DURATION_MINUTES = 1;
const MAX_FOCUS_DURATION_MINUTES = 240;
const FOCUS_STORAGE_PREFIX = 'daymap.focus.session.v1';

const normalizeFocusDurationMinutes = (value, fallback = DEFAULT_FOCUS_DURATION_MINUTES) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(MAX_FOCUS_DURATION_MINUTES, Math.max(MIN_FOCUS_DURATION_MINUTES, parsed));
};

const toHms = (date) => (
    `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}:${`${date.getSeconds()}`.padStart(2, '0')}`
);

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

const buildFocusStorageKey = (userId) => `${FOCUS_STORAGE_PREFIX}:${userId || 'anonymous'}`;

const readFocusStorage = (userId) => {
    try {
        const raw = localStorage.getItem(buildFocusStorageKey(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

const writeFocusStorage = (userId, payload) => {
    try {
        localStorage.setItem(buildFocusStorageKey(userId), JSON.stringify(payload));
    } catch {
        // Ignore storage write failures (private mode, quota exceeded, etc.)
    }
};

const clearFocusStorage = (userId) => {
    try {
        localStorage.removeItem(buildFocusStorageKey(userId));
    } catch {
        // Ignore storage removal failures
    }
};

const Dashboard = () => {
    const { tasks, fetchTasks, createDaySchedule } = useTasks();
    const { user } = useAuth();

    const [now, setNow] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [upcomingTasks, setUpcomingTasks] = useState([]);
    const [loadingUpcoming, setLoadingUpcoming] = useState(false);
    const [dashboardError, setDashboardError] = useState('');

    const [focusEnabled, setFocusEnabled] = useState(false);
    const [focusDurationMinutes, setFocusDurationMinutes] = useState(DEFAULT_FOCUS_DURATION_MINUTES);
    const [focusStartedAt, setFocusStartedAt] = useState(null);
    const [focusSessionId, setFocusSessionId] = useState(null);
    const [focusCompletionAttempted, setFocusCompletionAttempted] = useState(false);
    const [pendingFocusSession, setPendingFocusSession] = useState(null);
    const [pendingSyncAttempted, setPendingSyncAttempted] = useState(false);
    const [elapsedFocusSeconds, setElapsedFocusSeconds] = useState(0);
    const [focusError, setFocusError] = useState('');
    const [focusMessage, setFocusMessage] = useState('');
    const [savingFocusSession, setSavingFocusSession] = useState(false);
    const focusCompletingRef = useRef(false);

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

    const persistFocusState = useCallback((override = {}) => {
        const normalizedDuration = normalizeFocusDurationMinutes(focusDurationMinutes);
        const payload = {
            enabled: focusEnabled,
            durationMinutes: normalizedDuration,
            startedAt: focusStartedAt,
            sessionId: focusSessionId,
            completionAttempted: focusCompletionAttempted,
            pendingSession: pendingFocusSession,
            ...override
        };

        if (!user?.id) return;

        // Keep state when enabled or session is active. Otherwise clean up storage.
        if (!payload.enabled && !payload.startedAt) {
            clearFocusStorage(user.id);
            return;
        }

        writeFocusStorage(user.id, payload);
    }, [focusDurationMinutes, focusEnabled, focusSessionId, focusStartedAt, user?.id]);

    const syncPendingFocusSession = useCallback(async (sessionPayload) => {
        if (!sessionPayload || pendingSyncAttempted) return;

        setPendingSyncAttempted(true);

        try {
            await analyticsService.logFocusSession(sessionPayload);
            try {
                await loadFocusPatterns();
            } catch {
                // Non-blocking: focus stats can refresh later.
            }
            setPendingFocusSession(null);
            persistFocusState({ pendingSession: null });
        } catch (error) {
            if (!focusStartedAt) {
                setFocusError(error?.message || 'Could not sync the last focus session.');
            } else {
                setFocusMessage(error?.message || 'Focus session sync will retry later.');
            }
        }
    }, [focusStartedAt, loadFocusPatterns, pendingSyncAttempted, persistFocusState]);

    // Complete and log a focus session. Auto-complete should only attempt once per session.
    const completeFocusSession = useCallback(async (endTimestamp, reason = 'manual') => {
        if (!focusStartedAt || savingFocusSession || focusCompletingRef.current) return;
        if (reason === 'auto' && focusCompletionAttempted) return;

        focusCompletingRef.current = true;
        const normalizedDuration = normalizeFocusDurationMinutes(focusDurationMinutes);
        const safeEndTimestamp = Number.isFinite(endTimestamp) ? endTimestamp : Date.now();
        const durationSeconds = Math.max(0, Math.floor((safeEndTimestamp - focusStartedAt) / 1000));
        const durationMinutes = Math.min(1440, Math.max(1, Math.ceil(durationSeconds / 60)));
        const start = new Date(focusStartedAt);
        const end = new Date(safeEndTimestamp);

        setSavingFocusSession(true);
        setFocusError('');

        if (reason === 'auto') {
            setFocusCompletionAttempted(true);
            persistFocusState({ completionAttempted: true });
        }

        const sessionPayload = {
            date: toYmd(start),
            start_time: toHms(start),
            end_time: toHms(end),
            duration_minutes: Math.min(durationMinutes, normalizedDuration)
        };

        try {
            await analyticsService.logFocusSession(sessionPayload);
            try {
                await loadFocusPatterns();
            } catch {
                // Non-blocking: focus stats can refresh later.
            }
            setFocusMessage(`Great focus sprint! Logged ${Math.min(durationMinutes, normalizedDuration)} minute(s).`);
            setFocusStartedAt(null);
            setElapsedFocusSeconds(0);
            setFocusSessionId(null);
            setFocusCompletionAttempted(false);
            setPendingFocusSession(null);
            setPendingSyncAttempted(false);
            persistFocusState({ startedAt: null, sessionId: null, completionAttempted: false, pendingSession: null, enabled: true });
        } catch (error) {
            setPendingFocusSession(sessionPayload);
            setPendingSyncAttempted(false);
            persistFocusState({ pendingSession: sessionPayload });
            if (reason === 'auto') {
                setFocusError(error?.message || 'Auto-save failed. Your session was ended and will retry on next load.');
            } else {
                setFocusError(error?.message || 'Could not save focus session. It will retry on next load.');
            }
            // End the session locally even if save fails.
            setFocusStartedAt(null);
            setElapsedFocusSeconds(0);
            setFocusSessionId(null);
            setFocusCompletionAttempted(false);
        } finally {
            setSavingFocusSession(false);
            focusCompletingRef.current = false;
        }
    }, [focusCompletionAttempted, focusDurationMinutes, focusStartedAt, loadFocusPatterns, persistFocusState, savingFocusSession]);

    // Restore focus session from storage on load/navigation.
    useEffect(() => {
        if (!user?.id) return;

        const stored = readFocusStorage(user.id);
        if (!stored) return;

        const normalizedDuration = normalizeFocusDurationMinutes(stored.durationMinutes);
        const nowTimestamp = Date.now();
        const hasValidStart = Number.isFinite(stored.startedAt)
            && stored.startedAt > 0
            && stored.startedAt <= nowTimestamp + 60 * 1000;

        if (stored.startedAt && !hasValidStart) {
            // Invalid stored session (corrupted or from the future) -> reset safely.
            clearFocusStorage(user.id);
            setFocusDurationMinutes(normalizedDuration);
            setFocusEnabled(Boolean(stored.enabled));
            setFocusSessionId(null);
            setFocusStartedAt(null);
            setElapsedFocusSeconds(0);
            setFocusCompletionAttempted(false);
            setPendingFocusSession(null);
            setPendingSyncAttempted(false);
            return;
        }

        setFocusDurationMinutes(normalizedDuration);
        setFocusEnabled(Boolean(stored.enabled || hasValidStart));
        setFocusSessionId(hasValidStart ? stored.sessionId || `${stored.startedAt}` : null);
        setFocusStartedAt(hasValidStart ? stored.startedAt : null);
        setElapsedFocusSeconds(hasValidStart ? Math.max(0, Math.floor((Date.now() - stored.startedAt) / 1000)) : 0);
        setFocusCompletionAttempted(Boolean(stored.completionAttempted));
        setPendingFocusSession(stored.pendingSession || null);
        setPendingSyncAttempted(false);
    }, [user?.id]);

    useEffect(() => {
        if (!pendingFocusSession) return;
        syncPendingFocusSession(pendingFocusSession);
    }, [pendingFocusSession, syncPendingFocusSession]);

    // Timer loop that keeps countdown in sync and auto-completes when target ends.
    useEffect(() => {
        persistFocusState();
    }, [persistFocusState]);

    useEffect(() => {
        if (!focusStartedAt || !focusEnabled) return undefined;

        const normalizedDuration = normalizeFocusDurationMinutes(focusDurationMinutes);
        const endTimestamp = focusStartedAt + (normalizedDuration * 60 * 1000);

        if (Date.now() >= endTimestamp) {
            setElapsedFocusSeconds(normalizedDuration * 60);
            completeFocusSession(endTimestamp, 'auto');
            return undefined;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            setElapsedFocusSeconds(Math.min(normalizedDuration * 60, Math.max(0, Math.floor((now - focusStartedAt) / 1000))));
            if (now >= endTimestamp) {
                clearInterval(interval);
                completeFocusSession(endTimestamp, 'auto');
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [completeFocusSession, focusDurationMinutes, focusEnabled, focusStartedAt]);

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
        if (!focusEnabled) {
            setFocusError('Enable focus mode first.');
            return;
        }

        if (focusStartedAt || savingFocusSession) {
            return;
        }

        const normalizedDuration = normalizeFocusDurationMinutes(focusDurationMinutes);
        const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        setFocusError('');
        setFocusMessage('');
        setFocusDurationMinutes(normalizedDuration);
        setFocusStartedAt(Date.now());
        setFocusSessionId(sessionId);
        setFocusCompletionAttempted(false);
        setPendingSyncAttempted(false);
        setElapsedFocusSeconds(0);
    };

    const stopFocusMode = async () => {
        if (!focusStartedAt) {
            setFocusStartedAt(null);
            setElapsedFocusSeconds(0);
            setFocusSessionId(null);
            setFocusCompletionAttempted(false);
            setPendingSyncAttempted(false);
            persistFocusState({ startedAt: null, sessionId: null, completionAttempted: false });
            return;
        }

        await completeFocusSession(Date.now(), 'manual');
    };

    const handleFocusDurationChange = (event) => {
        const value = event.target.value;

        if (value === '') {
            setFocusDurationMinutes('');
            return;
        }

        if (!/^\d+$/.test(value)) {
            return;
        }

        setFocusDurationMinutes(value);
    };

    const handleFocusDurationBlur = () => {
        setFocusDurationMinutes(normalizeFocusDurationMinutes(focusDurationMinutes));
    };

    const toggleFocusEnabled = (event) => {
        const enabled = event.target.checked;

        if (!enabled && focusStartedAt) {
            setFocusError('Stop and save the active focus session before disabling Focus Mode.');
            return;
        }

        setFocusError('');
        setFocusMessage('');
        setFocusEnabled(enabled);
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
                                onChange={handleFocusDurationChange}
                                onBlur={handleFocusDurationBlur}
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
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

export default Dashboard;
