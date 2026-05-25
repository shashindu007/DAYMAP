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
import { useSchedule } from '../context/ScheduleContext';
import analyticsService from '../services/analyticsService';
import './FocusDashboard.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const DEFAULT_FOCUS_DURATION_MINUTES = 50;
const MIN_FOCUS_DURATION_MINUTES = 1;
const MAX_FOCUS_DURATION_MINUTES = 240;
const FOCUS_STORAGE_PREFIX = 'daymap.focus.session.v1';
const FOCUS_CATEGORY_OPTIONS = [
    'Deep Work',
    'Learning',
    'Reading',
    'Writing',
    'Coding',
    'Planning',
    'Admin',
    'Meetings',
    'Custom'
];
const FOCUS_GOAL_PRESETS = [
    'Finish a focused 25-min sprint',
    'Complete one chapter / section',
    'Clear priority inbox tasks',
    'Write 300 words',
    'Solve one tough problem'
];

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

const timeToMinutes = (value) => {
    if (!value) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return (hours * 60) + minutes;
};

const normalizeFocusDurationMinutes = (value, fallback = DEFAULT_FOCUS_DURATION_MINUTES) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(MAX_FOCUS_DURATION_MINUTES, Math.max(MIN_FOCUS_DURATION_MINUTES, parsed));
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
    const { scheduleByDate, fetchSchedule, updateScheduleTaskStatus } = useSchedule();

    const [now, setNow] = useState(new Date());

    const [focusEnabled, setFocusEnabled] = useState(false);
    const [focusDurationMinutes, setFocusDurationMinutes] = useState(DEFAULT_FOCUS_DURATION_MINUTES);
    const [focusStartedAt, setFocusStartedAt] = useState(null);
    const [focusSessionId, setFocusSessionId] = useState(null);
    const [focusStatus, setFocusStatus] = useState('idle');
    const [focusPausedAt, setFocusPausedAt] = useState(null);
    const [totalPausedSeconds, setTotalPausedSeconds] = useState(0);
    const [focusCompletionAttempted, setFocusCompletionAttempted] = useState(false);
    const [pendingFocusSession, setPendingFocusSession] = useState(null);
    const [pendingSyncAttempted, setPendingSyncAttempted] = useState(false);
    const [elapsedFocusSeconds, setElapsedFocusSeconds] = useState(0);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [focusTaskSnapshot, setFocusTaskSnapshot] = useState(null);
    const [focusError, setFocusError] = useState('');
    const [focusMessage, setFocusMessage] = useState('');
    const [savingFocusSession, setSavingFocusSession] = useState(false);
    const focusCompletingRef = useRef(false);
    const [focusCategory, setFocusCategory] = useState('');
    const [focusGoal, setFocusGoal] = useState('');
    const [customCategory, setCustomCategory] = useState('');

    const [focusPatterns, setFocusPatterns] = useState({
        todayMinutes: 0,
        todaySessions: 0,
        avgDailyMinutes: 0,
        avgSessionsPerDay: 0,
        bestDay: null
    });

    const [focusInsights, setFocusInsights] = useState({
        totals: {
            focus_time_spent_minutes: 0,
            focus_sessions_count: 0,
            focus_sessions_total: 0,
            focus_sessions_completed: 0
        },
        daily: [],
        weekly: [],
        byCategory: [],
        byTag: [],
        insights: []
    });
    const [focusInsightsLoading, setFocusInsightsLoading] = useState(false);
    const [focusInsightsError, setFocusInsightsError] = useState('');

    const todayYmd = useMemo(() => toYmd(now), [now]);

    const scheduleTasks = scheduleByDate[todayYmd]?.tasks || [];

    const currentTasks = useMemo(() => {
        const currentMinutes = (now.getHours() * 60) + now.getMinutes();
        return scheduleTasks.filter((task) => {
            if (['completed', 'cancelled'].includes(task.status)) return false;
            const startMinutes = timeToMinutes(task.slot_start_time);
            const endMinutes = timeToMinutes(task.slot_end_time);
            if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return false;
            return startMinutes <= currentMinutes && currentMinutes < endMinutes;
        });
    }, [now, scheduleTasks]);

    const selectedTask = useMemo(() => {
        if (selectedTaskId) {
            return scheduleTasks.find((task) => task.id === selectedTaskId) || focusTaskSnapshot || null;
        }
        return focusTaskSnapshot || null;
    }, [focusTaskSnapshot, scheduleTasks, selectedTaskId]);

    const focusRemainingTaskMinutes = useMemo(() => {
        if (!selectedTask?.slot_end_time) return null;
        const endMinutes = timeToMinutes(selectedTask.slot_end_time);
        if (!Number.isFinite(endMinutes)) return null;
        const currentMinutes = (now.getHours() * 60) + now.getMinutes();
        return Math.max(1, endMinutes - currentMinutes);
    }, [now, selectedTask]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!scheduleByDate[todayYmd]) {
            fetchSchedule(todayYmd).catch(() => null);
        }
    }, [fetchSchedule, scheduleByDate, todayYmd]);

    const persistFocusState = useCallback((override = {}) => {
        const normalizedDuration = normalizeFocusDurationMinutes(focusDurationMinutes);
        const payload = {
            enabled: focusEnabled,
            durationMinutes: normalizedDuration,
            startedAt: focusStartedAt,
            sessionId: focusSessionId,
            status: focusStatus,
            pausedAt: focusPausedAt,
            totalPausedSeconds,
            selectedTaskId,
            focusTaskSnapshot,
            completionAttempted: focusCompletionAttempted,
            pendingSession: pendingFocusSession,
            category: focusCategory,
            goal: focusGoal,
            ...override
        };

        if (!user?.id) return;

        if (!payload.enabled && !payload.startedAt && !payload.pendingSession) {
            clearFocusStorage(user.id);
            return;
        }

        writeFocusStorage(user.id, payload);
    }, [focusCategory, focusCompletionAttempted, focusDurationMinutes, focusEnabled, focusGoal, focusPausedAt, focusSessionId, focusStartedAt, focusStatus, focusTaskSnapshot, pendingFocusSession, selectedTaskId, totalPausedSeconds, user?.id]);

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
                totals: data.totals || {
                    focus_time_spent_minutes: 0,
                    focus_sessions_count: 0,
                    focus_sessions_total: 0,
                    focus_sessions_completed: 0
                },
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
                totals: {
                    focus_time_spent_minutes: 0,
                    focus_sessions_count: 0,
                    focus_sessions_total: 0,
                    focus_sessions_completed: 0
                },
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
            }, { focus_time_spent_minutes: 0, focus_sessions_count: 0, focus_sessions_total: 0, focus_sessions_completed: 0 });

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

    const getElapsedSeconds = useCallback((timestamp = Date.now()) => {
        if (!focusStartedAt) return 0;
        const baseElapsed = Math.max(0, Math.floor((timestamp - focusStartedAt) / 1000));
        const pausedOffset = totalPausedSeconds + (
            focusStatus === 'paused' && focusPausedAt
                ? Math.max(0, Math.floor((timestamp - focusPausedAt) / 1000))
                : 0
        );
        return Math.max(0, baseElapsed - pausedOffset);
    }, [focusPausedAt, focusStartedAt, focusStatus, totalPausedSeconds]);

    const completeFocusSession = useCallback(async (endTimestamp, reason = 'manual') => {
        if (!focusStartedAt || savingFocusSession || focusCompletingRef.current) return;
        if (reason === 'auto' && focusCompletionAttempted) return;

        focusCompletingRef.current = true;
        const normalizedDuration = normalizeFocusDurationMinutes(focusDurationMinutes);
        const safeEndTimestamp = Number.isFinite(endTimestamp) ? endTimestamp : Date.now();
        const elapsedSeconds = getElapsedSeconds(safeEndTimestamp);
        const maxSeconds = normalizedDuration * 60;
        const actualSeconds = Math.min(elapsedSeconds, maxSeconds);
        const actualMinutes = Math.min(1440, Math.max(1, Math.ceil(actualSeconds / 60)));
        const targetMinutes = Math.min(1440, Math.max(1, normalizedDuration));
        const start = new Date(focusStartedAt);
        const end = new Date(safeEndTimestamp);
        const status = reason === 'auto' || actualSeconds >= maxSeconds ? 'completed' : 'partial';

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
            duration_minutes: actualMinutes,
            target_minutes: targetMinutes,
            actual_minutes: actualMinutes,
            status,
            schedule_task_id: selectedTask?.id || null,
            category: focusCategory.trim()
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
            setFocusStatus('idle');
            setFocusPausedAt(null);
            setTotalPausedSeconds(0);
            setFocusCompletionAttempted(false);
            setPendingFocusSession(null);
            setPendingSyncAttempted(false);
            persistFocusState({
                startedAt: null,
                sessionId: null,
                status: 'idle',
                pausedAt: null,
                totalPausedSeconds: 0,
                completionAttempted: false,
                pendingSession: null,
                enabled: true
            });

            if (selectedTask?.id) {
                const endMinutes = timeToMinutes(selectedTask.slot_end_time);
                const currentMinutes = (new Date()).getHours() * 60 + (new Date()).getMinutes();
                const shouldComplete = Number.isFinite(endMinutes) && currentMinutes >= endMinutes;
                const nextStatus = shouldComplete ? 'completed' : 'in_progress';
                await updateScheduleTaskStatus(selectedTask.id, nextStatus);
            }
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
            setFocusStatus('idle');
            setFocusPausedAt(null);
            setTotalPausedSeconds(0);
            setFocusCompletionAttempted(false);
        } finally {
            setSavingFocusSession(false);
            focusCompletingRef.current = false;
        }
    }, [focusCategory, focusCompletionAttempted, focusDurationMinutes, focusGoal, focusStartedAt, getElapsedSeconds, loadFocusInsights, persistFocusState, savingFocusSession, selectedTask, updateScheduleTaskStatus]);

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
        const restoredStatus = hasValidStart
            ? (stored.status === 'paused' ? 'paused' : 'running')
            : 'idle';
        const restoredPausedAt = stored.status === 'paused' ? stored.pausedAt : null;
        const restoredPausedSeconds = Number.isFinite(stored.totalPausedSeconds)
            ? Math.max(0, stored.totalPausedSeconds)
            : 0;

        if (stored.startedAt && !hasValidStart) {
            const pendingSession = stored.pendingSession || null;
            setFocusDurationMinutes(normalizedDuration);
            setFocusEnabled(Boolean(stored.enabled));
            setFocusSessionId(null);
            setFocusStartedAt(null);
            setFocusStatus('idle');
            setFocusPausedAt(null);
            setTotalPausedSeconds(0);
            setElapsedFocusSeconds(0);
            setFocusCompletionAttempted(false);
            setPendingFocusSession(pendingSession);
            setPendingSyncAttempted(false);
            const storedCategory = typeof stored.category === 'string' ? stored.category : '';
            setFocusCategory(storedCategory);
            setCustomCategory(storedCategory && !FOCUS_CATEGORY_OPTIONS.includes(storedCategory) ? storedCategory : '');
            setFocusGoal(typeof stored.goal === 'string' ? stored.goal : '');
            setSelectedTaskId(stored.selectedTaskId || null);
            setFocusTaskSnapshot(stored.focusTaskSnapshot || null);

            if (pendingSession) {
                writeFocusStorage(user.id, {
                    enabled: Boolean(stored.enabled),
                    durationMinutes: normalizedDuration,
                    startedAt: null,
                    sessionId: null,
                    completionAttempted: false,
                    pendingSession,
                    category: typeof stored.category === 'string' ? stored.category : '',
                    goal: typeof stored.goal === 'string' ? stored.goal : ''
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
        setFocusStatus(restoredStatus);
        setFocusPausedAt(restoredPausedAt);
        setTotalPausedSeconds(restoredPausedSeconds);
        if (hasValidStart) {
            const baseElapsed = Math.max(0, Math.floor((Date.now() - stored.startedAt) / 1000));
            const pausedOffset = restoredPausedSeconds + (restoredStatus === 'paused' && restoredPausedAt
                ? Math.max(0, Math.floor((Date.now() - restoredPausedAt) / 1000))
                : 0);
            setElapsedFocusSeconds(Math.max(0, baseElapsed - pausedOffset));
        } else {
            setElapsedFocusSeconds(0);
        }
        setFocusCompletionAttempted(hasValidStart && stored.sessionId && stored.sessionId === restoredSessionId
            ? Boolean(stored.completionAttempted)
            : false);
        setPendingFocusSession(stored.pendingSession || null);
        setPendingSyncAttempted(false);
        const storedCategory = typeof stored.category === 'string' ? stored.category : '';
        setFocusCategory(storedCategory);
        setCustomCategory(storedCategory && !FOCUS_CATEGORY_OPTIONS.includes(storedCategory) ? storedCategory : '');
        setFocusGoal(typeof stored.goal === 'string' ? stored.goal : '');
        setSelectedTaskId(stored.selectedTaskId || null);
        setFocusTaskSnapshot(stored.focusTaskSnapshot || null);
    }, [user?.id]);

    useEffect(() => {
        if (!pendingFocusSession) return;
        syncPendingFocusSession(pendingFocusSession);
    }, [pendingFocusSession, syncPendingFocusSession]);

    useEffect(() => {
        if (focusStatus !== 'idle') return;
        if (currentTasks.length === 1) {
            setSelectedTaskId(currentTasks[0].id);
            setFocusTaskSnapshot(currentTasks[0]);
            if (focusRemainingTaskMinutes) {
                setFocusDurationMinutes(Math.min(focusRemainingTaskMinutes, DEFAULT_FOCUS_DURATION_MINUTES));
            }
        }
    }, [currentTasks, focusRemainingTaskMinutes, focusStatus]);

    useEffect(() => {
        if (focusStatus !== 'idle' || !selectedTask) return;
        if (focusRemainingTaskMinutes) {
            setFocusDurationMinutes(Math.min(focusRemainingTaskMinutes, DEFAULT_FOCUS_DURATION_MINUTES));
        }
    }, [focusRemainingTaskMinutes, focusStatus, selectedTask]);

    useEffect(() => {
        loadFocusInsights();
    }, [loadFocusInsights]);

    useEffect(() => {
        persistFocusState();
    }, [persistFocusState]);

    useEffect(() => {
        if (!focusStartedAt || !focusEnabled || focusStatus !== 'running') return undefined;

        const normalizedDuration = normalizeFocusDurationMinutes(focusDurationMinutes);
        const maxSeconds = normalizedDuration * 60;

        const interval = setInterval(() => {
            const elapsed = getElapsedSeconds();
            const remaining = Math.max(0, maxSeconds - elapsed);
            setElapsedFocusSeconds(Math.min(maxSeconds, elapsed));
            if (remaining <= 0) {
                clearInterval(interval);
                completeFocusSession(Date.now(), 'auto');
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [completeFocusSession, focusDurationMinutes, focusEnabled, focusStartedAt, focusStatus, getElapsedSeconds]);

    const projectedEndTime = useMemo(() => {
        if (!focusStartedAt || !focusEnabled) return null;
        const durationMs = Math.max(1, Number(focusDurationMinutes) || 1) * 60 * 1000;
        const pauseOffset = (totalPausedSeconds * 1000)
            + (focusStatus === 'paused' && focusPausedAt ? (Date.now() - focusPausedAt) : 0);
        return new Date(focusStartedAt + durationMs + pauseOffset);
    }, [focusDurationMinutes, focusEnabled, focusPausedAt, focusStartedAt, focusStatus, totalPausedSeconds]);

    const focusTotalSeconds = useMemo(() => (
        Math.max(1, Number(focusDurationMinutes) || 1) * 60
    ), [focusDurationMinutes]);

    const focusRemainingSeconds = useMemo(() => (
        Math.max(0, focusTotalSeconds - elapsedFocusSeconds)
    ), [elapsedFocusSeconds, focusTotalSeconds]);

    const focusProgressPercent = useMemo(() => (
        Math.min(100, Math.max(0, (elapsedFocusSeconds / focusTotalSeconds) * 100))
    ), [elapsedFocusSeconds, focusTotalSeconds]);

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
        const normalized = normalizeFocusDurationMinutes(focusDurationMinutes);
        if (focusRemainingTaskMinutes) {
            setFocusDurationMinutes(Math.min(normalized, focusRemainingTaskMinutes));
            return;
        }
        setFocusDurationMinutes(normalized);
    };

    const startFocusMode = async () => {
        if (!focusEnabled) {
            setFocusError('Enable focus mode first.');
            return;
        }

        if (focusStartedAt || savingFocusSession || focusStatus !== 'idle') {
            return;
        }

        if (!selectedTask || !currentTasks.some((task) => task.id === selectedTask.id)) {
            setFocusError('Select an active task to start focus.');
            return;
        }

        if (['completed', 'cancelled'].includes(selectedTask.status)) {
            setFocusError('Completed tasks cannot enter focus mode.');
            return;
        }

        const normalizedDuration = normalizeFocusDurationMinutes(focusDurationMinutes);
        const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        setFocusError('');
        setFocusMessage('');
        if (focusRemainingTaskMinutes) {
            setFocusDurationMinutes(Math.min(normalizedDuration, focusRemainingTaskMinutes));
        } else {
            setFocusDurationMinutes(normalizedDuration);
        }
        setFocusStartedAt(Date.now());
        setFocusSessionId(sessionId);
        setFocusStatus('running');
        setFocusPausedAt(null);
        setTotalPausedSeconds(0);
        setFocusCompletionAttempted(false);
        setPendingFocusSession(null);
        setPendingSyncAttempted(false);
        setElapsedFocusSeconds(0);
        setFocusTaskSnapshot(selectedTask);

        if (selectedTask.status === 'pending') {
            try {
                await updateScheduleTaskStatus(selectedTask.id, 'in_progress');
            } catch (error) {
                setFocusError('Unable to update task status for focus mode.');
            }
        }
    };

    const stopFocusMode = async () => {
        if (!focusStartedAt) {
            setFocusStartedAt(null);
            setElapsedFocusSeconds(0);
            setFocusSessionId(null);
            setFocusStatus('idle');
            setFocusPausedAt(null);
            setTotalPausedSeconds(0);
            setFocusCompletionAttempted(false);
            setPendingFocusSession(null);
            setPendingSyncAttempted(false);
            persistFocusState({
                startedAt: null,
                sessionId: null,
                status: 'idle',
                pausedAt: null,
                totalPausedSeconds: 0,
                completionAttempted: false,
                pendingSession: null
            });
            return;
        }

        await completeFocusSession(Date.now(), 'manual');
    };

    const pauseFocusMode = () => {
        if (focusStatus !== 'running' || !focusStartedAt) return;
        setElapsedFocusSeconds(getElapsedSeconds());
        setFocusStatus('paused');
        setFocusPausedAt(Date.now());
    };

    const resumeFocusMode = () => {
        if (focusStatus !== 'paused' || !focusStartedAt || !focusPausedAt) return;
        const pausedSeconds = Math.max(0, Math.floor((Date.now() - focusPausedAt) / 1000));
        setTotalPausedSeconds((prev) => prev + pausedSeconds);
        setFocusPausedAt(null);
        setFocusStatus('running');
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

            <div className="focus-layout focus-layout-stacked">
                <section className="card focus-hero focus-section">
                    <div className="focus-hero-header">
                        <h2>Focus Session</h2>
                        <span className="muted">Set your target and hit start.</span>
                    </div>

                    {!focusEnabled ? (
                        <p className="muted focus-disabled">Enable focus mode to start a new session and track your time.</p>
                    ) : (
                        <>
                            <div className="focus-task-panel">
                                <div className="focus-task-header">
                                    <h3>Current Task</h3>
                                    <span className="muted">Only ongoing tasks can enter focus mode.</span>
                                </div>

                                {currentTasks.length === 0 ? (
                                    <div className="focus-task-empty">
                                        No active tasks right now. Start a scheduled task to focus.
                                    </div>
                                ) : (
                                    <>
                                        {currentTasks.length > 1 && (
                                            <label className="focus-task-select">
                                                <span className="muted">Choose active task</span>
                                                <select
                                                    value={selectedTaskId || ''}
                                                    onChange={(event) => {
                                                        const nextId = event.target.value || null;
                                                        setSelectedTaskId(nextId);
                                                        const nextTask = currentTasks.find((task) => task.id === nextId) || null;
                                                        setFocusTaskSnapshot(nextTask);
                                                    }}
                                                    disabled={focusStatus !== 'idle'}
                                                >
                                                    <option value="">Select a task</option>
                                                    {currentTasks.map((task) => (
                                                        <option key={task.id} value={task.id}>
                                                            {task.title}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        )}

                                        {selectedTask && (
                                            <div className="focus-task-card">
                                                <div>
                                                    <h4>{selectedTask.title}</h4>
                                                    {selectedTask.description && (
                                                        <p className="muted">{selectedTask.description}</p>
                                                    )}
                                                    <div className="focus-task-meta">
                                                        <span>⏰ {selectedTask.slot_start_time?.slice(0, 5)} - {selectedTask.slot_end_time?.slice(0, 5)}</span>
                                                        <span className={`task-priority priority-${selectedTask.priority || 'medium'}`}>
                                                            {selectedTask.priority || 'medium'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="focus-task-status">
                                                    <span className={`task-status-badge ${selectedTask.status === 'in_progress' ? 'status-current' : 'status-upcoming'}`}>
                                                        {selectedTask.status === 'in_progress' ? 'In Progress' : 'Pending'}
                                                    </span>
                                                    {focusRemainingTaskMinutes && (
                                                        <span className="focus-task-remaining">{focusRemainingTaskMinutes} min left</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="focus-settings-row">
                                <label htmlFor="focus-duration" className="muted">Session target (minutes)</label>
                                <input
                                    id="focus-duration"
                                    className="input focus-duration-input"
                                    type="number"
                                    min="1"
                                    max={focusRemainingTaskMinutes || 240}
                                    value={focusDurationMinutes}
                                    onChange={handleFocusDurationChange}
                                    onBlur={handleFocusDurationBlur}
                                    disabled={Boolean(focusStartedAt)}
                                />
                            </div>

                            <div className="focus-metadata-grid">
                                <label className="focus-metadata-field">
                                    <span className="muted">Category</span>
                                    <div className="focus-category-grid" aria-label="Focus category">
                                        {FOCUS_CATEGORY_OPTIONS.map((option) => {
                                            const isCustom = option === 'Custom';
                                            const selected = isCustom
                                                ? Boolean(customCategory)
                                                : focusCategory === option;
                                            return (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    className={`focus-category-chip ${selected ? 'is-selected' : ''}`}
                                                    onClick={() => {
                                                        if (focusStartedAt) return;
                                                        if (isCustom) {
                                                            setFocusCategory(customCategory || '');
                                                        } else {
                                                            setCustomCategory('');
                                                            setFocusCategory(selected ? '' : option);
                                                        }
                                                    }}
                                                    disabled={Boolean(focusStartedAt)}
                                                >
                                                    {option}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {(customCategory || (!FOCUS_CATEGORY_OPTIONS.includes(focusCategory) && focusCategory)) && (
                                        <input
                                            className="input focus-category-custom"
                                            type="text"
                                            placeholder="Type a custom category"
                                            value={customCategory}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                setCustomCategory(value);
                                                setFocusCategory(value);
                                            }}
                                            disabled={Boolean(focusStartedAt)}
                                        />
                                    )}
                                </label>
                                <label className="focus-metadata-field">
                                    <span className="muted">Set your focus goal</span>
                                    <input
                                        className="input"
                                        type="text"
                                        placeholder="Finish chapter 4, close inbox, etc."
                                        value={focusGoal}
                                        onChange={(event) => setFocusGoal(event.target.value)}
                                        disabled={Boolean(focusStartedAt)}
                                    />
                                    <div className="focus-goal-presets" aria-label="Focus goal presets">
                                        {FOCUS_GOAL_PRESETS.map((preset) => (
                                            <button
                                                key={preset}
                                                type="button"
                                                className="focus-goal-chip"
                                                onClick={() => {
                                                    if (focusStartedAt) return;
                                                    setFocusGoal(preset);
                                                }}
                                                disabled={Boolean(focusStartedAt)}
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                </label>
                            </div>

                            <div className="focus-live-box">
                                <div className="focus-timer-row">
                                    <p className="focus-timer">{formatElapsed(focusRemainingSeconds)}</p>
                                    <div className="focus-progress-ring" style={{ '--progress': `${focusProgressPercent}%` }}>
                                        <span>{Math.round(focusProgressPercent)}%</span>
                                    </div>
                                </div>
                                <div className="focus-timer-meta">
                                    <span>Started: {focusStartedAt ? new Date(focusStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                    <span>Ends: {projectedEndTime ? projectedEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                    <span>Total: {focusDurationMinutes} min</span>
                                </div>
                            </div>

                            <div className="focus-actions">
                                {focusStatus === 'idle' ? (
                                    <button className="btn btn-primary" type="button" onClick={startFocusMode}>
                                        Start Focus
                                    </button>
                                ) : (
                                    <div className="focus-action-group">
                                        {focusStatus === 'running' ? (
                                            <button className="btn btn-outline" type="button" onClick={pauseFocusMode}>
                                                Pause
                                            </button>
                                        ) : (
                                            <button className="btn btn-secondary" type="button" onClick={resumeFocusMode}>
                                                Resume
                                            </button>
                                        )}
                                        <button className="btn btn-danger" type="button" onClick={stopFocusMode} disabled={savingFocusSession}>
                                            {savingFocusSession ? 'Saving...' : 'Stop Focus'}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {focusError && <p className="dashboard-error">{focusError}</p>}
                            {focusMessage && <div className="focus-complete-banner">{focusMessage}</div>}
                        </>
                    )}
                </section>

                <section className="card focus-stats focus-section">
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
                                <p className="muted focus-chart-empty">Add a goal above to keep your session aligned.</p>
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
