import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAuth } from '../context/AuthContext';
import analyticsService from '../services/analyticsService';
import './FocusDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const DEFAULT_FOCUS_DURATION_MINUTES = 50;
const MIN_FOCUS_DURATION_MINUTES = 1;
const MAX_FOCUS_DURATION_MINUTES = 240;
const FOCUS_STORAGE_PREFIX = 'daymap.focus.session.v1';

const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
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

const normalizeFocusDurationMinutes = (value, fallback = DEFAULT_FOCUS_DURATION_MINUTES) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(MAX_FOCUS_DURATION_MINUTES, Math.max(MIN_FOCUS_DURATION_MINUTES, parsed));
};

const parseFocusTags = (value) => (
    typeof value === 'string'
        ? value.split(',').map((tag) => tag.trim()).filter(Boolean)
        : []
);

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

const extractFocusPatternPayload = (response) => (
    response?.data
    || response?.data?.data
    || response
    || {}
);

const resolveFocusErrorMessage = (error, fallback) => (
    error?.errors?.[0]?.message
    || error?.error
    || error?.message
    || fallback
);

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

const FocusDashboard = () => {
    const { user } = useAuth();

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
    const [focusCategory, setFocusCategory] = useState('');
    const [focusTags, setFocusTags] = useState('');

    const [focusPatterns, setFocusPatterns] = useState({
        todayMinutes: 0,
        todaySessions: 0,
        avgDailyMinutes: 0,
        avgSessionsPerDay: 0,
        bestDay: null
    });

    const [focusInsights, setFocusInsights] = useState({
        totals: { focus_time_spent_minutes: 0, focus_sessions_count: 0 },
        daily: [],
        weekly: [],
        byCategory: [],
        byTag: [],
        insights: []
    });
    const [focusInsightsLoading, setFocusInsightsLoading] = useState(false);
    const [focusInsightsError, setFocusInsightsError] = useState('');

    const todayYmd = useMemo(() => toYmd(new Date()), []);

    const persistFocusState = useCallback((override = {}) => {
        const normalizedDuration = normalizeFocusDurationMinutes(focusDurationMinutes);
        const payload = {
            enabled: focusEnabled,
            durationMinutes: normalizedDuration,
            startedAt: focusStartedAt,
            sessionId: focusSessionId,
            completionAttempted: focusCompletionAttempted,
            pendingSession: pendingFocusSession,
            category: focusCategory,
            tags: focusTags,
            ...override
        };

        if (!user?.id) return;

        if (!payload.enabled && !payload.startedAt && !payload.pendingSession) {
            clearFocusStorage(user.id);
            return;
        }

        writeFocusStorage(user.id, payload);
    }, [focusCategory, focusCompletionAttempted, focusDurationMinutes, focusEnabled, focusSessionId, focusStartedAt, focusTags, pendingFocusSession, user?.id]);

    const loadFocusInsights = useCallback(async () => {
        try {
            setFocusInsightsLoading(true);
            setFocusInsightsError('');
            const response = await analyticsService.getFocusInsights(14);
            const data = extractFocusPatternPayload(response);
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
                totals: data.totals || { focus_time_spent_minutes: 0, focus_sessions_count: 0 },
                daily,
                weekly: data.weekly || [],
                byCategory: data.by_category || [],
                byTag: data.by_tag || [],
                insights: data.insights || []
            });
        } catch (error) {
            setFocusInsightsError(resolveFocusErrorMessage(error, 'Failed to load focus insights.'));
            setFocusPatterns({
                todayMinutes: 0,
                todaySessions: 0,
                avgDailyMinutes: 0,
                avgSessionsPerDay: 0,
                bestDay: null
            });
            setFocusInsights({
                totals: { focus_time_spent_minutes: 0, focus_sessions_count: 0 },
                daily: [],
                weekly: [],
                byCategory: [],
                byTag: [],
                insights: []
            });
        } finally {
            setFocusInsightsLoading(false);
        }
    }, [todayYmd]);

    const applyTodayFocusUpdate = useCallback((payload) => {
        const data = extractFocusPatternPayload(payload);
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
                            focus_sessions_count: data.focus_sessions_count ?? item.focus_sessions_count
                        }
                        : item
                ))
                : [...prev.daily, {
                    date: data.date,
                    focus_time_spent_minutes: data.focus_time_spent_minutes || 0,
                    focus_sessions_count: data.focus_sessions_count || 0
                }].sort((a, b) => a.date.localeCompare(b.date));

            const totals = updatedDaily.reduce((acc, item) => {
                acc.focus_time_spent_minutes += item.focus_time_spent_minutes || 0;
                acc.focus_sessions_count += item.focus_sessions_count || 0;
                return acc;
            }, { focus_time_spent_minutes: 0, focus_sessions_count: 0 });

            return {
                ...prev,
                daily: updatedDaily,
                totals
            };
        });
    }, []);

    const syncPendingFocusSession = useCallback(async (sessionPayload) => {
        if (!sessionPayload || pendingSyncAttempted) return;

        setPendingSyncAttempted(true);

        try {
            const response = await analyticsService.logFocusSession(sessionPayload);
            applyTodayFocusUpdate(response?.data || response);
            try {
                await loadFocusInsights();
            } catch {
                // Non-blocking: focus stats can refresh later.
            }
            setPendingFocusSession(null);
            setFocusError('');
            setFocusMessage('');
            persistFocusState({ pendingSession: null });
        } catch (error) {
            const message = resolveFocusErrorMessage(error, 'Failed to sync focus session.');
            if (/no response from server/i.test(message)) {
                setFocusError('');
                setFocusMessage('Session saved locally. Will sync when back online.');
            } else {
                setFocusError(message);
                setFocusMessage('');
            }
        }
    }, [loadFocusInsights, pendingSyncAttempted, persistFocusState]);

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
            duration_minutes: Math.min(durationMinutes, normalizedDuration),
            category: focusCategory.trim(),
            tags: parseFocusTags(focusTags)
        };

        try {
            const response = await analyticsService.logFocusSession(sessionPayload);
            applyTodayFocusUpdate(response?.data || response);
            try {
                await loadFocusInsights();
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
            const message = resolveFocusErrorMessage(error, 'Failed to save focus session.');
            if (/no response from server/i.test(message)) {
                setPendingFocusSession(sessionPayload);
                setPendingSyncAttempted(false);
                persistFocusState({ pendingSession: sessionPayload });
                setFocusError('');
                setFocusMessage('Session saved locally. Will sync when back online.');
            } else {
                setFocusError(message);
                setFocusMessage('');
            }
            setFocusStartedAt(null);
            setElapsedFocusSeconds(0);
            setFocusSessionId(null);
            setFocusCompletionAttempted(false);
        } finally {
            setSavingFocusSession(false);
            focusCompletingRef.current = false;
        }
    }, [focusCategory, focusCompletionAttempted, focusDurationMinutes, focusStartedAt, focusTags, loadFocusInsights, persistFocusState, savingFocusSession]);

    useEffect(() => {
        if (!user?.id) return;

        const stored = readFocusStorage(user.id);
        if (!stored) return;

        const normalizedDuration = normalizeFocusDurationMinutes(stored.durationMinutes);
        const nowTimestamp = Date.now();
        const hasValidStart = Number.isFinite(stored.startedAt)
            && stored.startedAt > 0
            && stored.startedAt <= nowTimestamp + 60 * 1000;
        const restoredSessionId = hasValidStart ? (stored.sessionId || `${stored.startedAt}`) : null;

        if (stored.startedAt && !hasValidStart) {
            const pendingSession = stored.pendingSession || null;
            setFocusDurationMinutes(normalizedDuration);
            setFocusEnabled(Boolean(stored.enabled));
            setFocusSessionId(null);
            setFocusStartedAt(null);
            setElapsedFocusSeconds(0);
            setFocusCompletionAttempted(false);
            setPendingFocusSession(pendingSession);
            setPendingSyncAttempted(false);
            setFocusCategory(typeof stored.category === 'string' ? stored.category : '');
            setFocusTags(typeof stored.tags === 'string' ? stored.tags : '');

            if (pendingSession) {
                writeFocusStorage(user.id, {
                    enabled: Boolean(stored.enabled),
                    durationMinutes: normalizedDuration,
                    startedAt: null,
                    sessionId: null,
                    completionAttempted: false,
                    pendingSession,
                    category: typeof stored.category === 'string' ? stored.category : '',
                    tags: typeof stored.tags === 'string' ? stored.tags : ''
                });
            } else {
                clearFocusStorage(user.id);
            }
            return;
        }

        setFocusDurationMinutes(normalizedDuration);
        setFocusEnabled(Boolean(stored.enabled || hasValidStart));
        setFocusSessionId(restoredSessionId);
        setFocusStartedAt(hasValidStart ? stored.startedAt : null);
        setElapsedFocusSeconds(hasValidStart ? Math.max(0, Math.floor((Date.now() - stored.startedAt) / 1000)) : 0);
        setFocusCompletionAttempted(hasValidStart && stored.sessionId && stored.sessionId === restoredSessionId
            ? Boolean(stored.completionAttempted)
            : false);
        setPendingFocusSession(stored.pendingSession || null);
        setPendingSyncAttempted(false);
        setFocusCategory(typeof stored.category === 'string' ? stored.category : '');
        setFocusTags(typeof stored.tags === 'string' ? stored.tags : '');
    }, [user?.id]);

    useEffect(() => {
        if (!pendingFocusSession) return;
        syncPendingFocusSession(pendingFocusSession);
    }, [pendingFocusSession, syncPendingFocusSession]);

    useEffect(() => {
        loadFocusInsights();
    }, [loadFocusInsights]);

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

    const projectedEndTime = useMemo(() => {
        if (!focusStartedAt || !focusEnabled) return null;
        const endTimestamp = focusStartedAt + (Math.max(1, Number(focusDurationMinutes) || 1) * 60 * 1000);
        return new Date(endTimestamp);
    }, [focusDurationMinutes, focusEnabled, focusStartedAt]);

    const chartColors = [
        '#6366F1',
        '#22C55E',
        '#F97316',
        '#06B6D4',
        '#A855F7',
        '#F43F5E',
        '#EAB308',
        '#14B8A6'
    ];

    const dailyChartData = useMemo(() => {
        if (!focusInsights.daily?.length) return null;
        return {
            labels: focusInsights.daily.map((item) => item.date.slice(5)),
            datasets: [
                {
                    label: 'Focus minutes',
                    data: focusInsights.daily.map((item) => item.focus_time_spent_minutes || 0),
                    backgroundColor: 'rgba(99, 102, 241, 0.6)'
                }
            ]
        };
    }, [focusInsights.daily]);

    const weeklyChartData = useMemo(() => {
        if (!focusInsights.weekly?.length) return null;
        return {
            labels: focusInsights.weekly.map((item) => item.week_start.slice(5)),
            datasets: [
                {
                    label: 'Weekly focus minutes',
                    data: focusInsights.weekly.map((item) => item.focus_time_spent_minutes || 0),
                    backgroundColor: 'rgba(34, 197, 94, 0.6)'
                }
            ]
        };
    }, [focusInsights.weekly]);

    const categoryChartData = useMemo(() => {
        if (!focusInsights.byCategory?.length) return null;
        return {
            labels: focusInsights.byCategory.map((item) => item.label),
            datasets: [
                {
                    label: 'Category distribution',
                    data: focusInsights.byCategory.map((item) => item.minutes || 0),
                    backgroundColor: focusInsights.byCategory.map((_, index) => chartColors[index % chartColors.length])
                }
            ]
        };
    }, [chartColors, focusInsights.byCategory]);

    const tagChartData = useMemo(() => {
        if (!focusInsights.byTag?.length) return null;
        return {
            labels: focusInsights.byTag.map((item) => item.label),
            datasets: [
                {
                    label: 'Tag distribution',
                    data: focusInsights.byTag.map((item) => item.minutes || 0),
                    backgroundColor: focusInsights.byTag.map((_, index) => chartColors[(index + 3) % chartColors.length])
                }
            ]
        };
    }, [chartColors, focusInsights.byTag]);

    const barOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
        }
    }), []);

    const pieOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' }
        }
    }), []);

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
        setPendingFocusSession(null);
        setPendingSyncAttempted(false);
        setElapsedFocusSeconds(0);
    };

    const stopFocusMode = async () => {
        if (!focusStartedAt) {
            setFocusStartedAt(null);
            setElapsedFocusSeconds(0);
            setFocusSessionId(null);
            setFocusCompletionAttempted(false);
            setPendingFocusSession(null);
            setPendingSyncAttempted(false);
            persistFocusState({ startedAt: null, sessionId: null, completionAttempted: false, pendingSession: null });
            return;
        }

        await completeFocusSession(Date.now(), 'manual');
    };

    const toggleFocusEnabled = async (event) => {
        const enabled = event.target.checked;

        if (savingFocusSession) {
            return;
        }

        setFocusError('');
        setFocusMessage('');

        if (!enabled && focusStartedAt) {
            await stopFocusMode();
        }

        setFocusEnabled(enabled);
    };

    return (
        <div className="focus-dashboard-container">
            <div className="focus-header">
                <div>
                    <h1>Focus Mode</h1>
                    <p className="muted">Stay locked in with a dedicated focus dashboard and weekly insights.</p>
                </div>
                <label className="focus-toggle">
                    <input
                        className="focus-toggle-input"
                        type="checkbox"
                        checked={focusEnabled}
                        onChange={toggleFocusEnabled}
                        disabled={savingFocusSession}
                    />
                    <span className="focus-toggle-track">
                        <span className="focus-toggle-thumb" />
                    </span>
                    <span className="focus-toggle-label">{focusEnabled ? 'Enabled' : 'Enable'}</span>
                </label>
            </div>

            <div className="focus-layout">
                <section className="card focus-hero">
                    <div className="focus-hero-header">
                        <h2>Focus Session</h2>
                        <span className="muted">Set your target and hit start.</span>
                    </div>

                    {!focusEnabled ? (
                        <p className="muted focus-disabled">Enable focus mode to start a new session and track your time.</p>
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

                            <div className="focus-metadata-grid">
                                <label className="focus-metadata-field">
                                    <span className="muted">Category</span>
                                    <input
                                        className="input"
                                        type="text"
                                        placeholder="e.g. Deep work"
                                        value={focusCategory}
                                        onChange={(event) => setFocusCategory(event.target.value)}
                                        disabled={Boolean(focusStartedAt)}
                                    />
                                </label>
                                <label className="focus-metadata-field">
                                    <span className="muted">Tags (comma-separated)</span>
                                    <input
                                        className="input"
                                        type="text"
                                        placeholder="research, reading"
                                        value={focusTags}
                                        onChange={(event) => setFocusTags(event.target.value)}
                                        disabled={Boolean(focusStartedAt)}
                                    />
                                </label>
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
                        </>
                    )}
                </section>

                <section className="card focus-stats">
                    <h2>Focus Metrics</h2>
                    <p className="muted">Track your momentum across the last two weeks.</p>

                    {focusInsightsError && <p className="dashboard-error">{focusInsightsError}</p>}

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
                            <p>{focusInsights.totals.focus_sessions_count || 0}</p>
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
                            <h3>Tag Distribution</h3>
                            {tagChartData ? (
                                <div className="focus-chart">
                                    <Pie data={tagChartData} options={pieOptions} />
                                </div>
                            ) : (
                                <p className="muted focus-chart-empty">Add tags to see distribution.</p>
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
