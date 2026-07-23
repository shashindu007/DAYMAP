import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { useTasks } from '../context/TaskContext';
import analyticsService from '../services/analyticsService';
import { isResolvedStatus } from '../utils/taskStatus';
import {
    DEFAULT_FOCUS_DURATION_MINUTES,
    MAX_FOCUS_DURATION_MINUTES,
    FOCUS_CATEGORY_OPTIONS,
    toYmd,
    toHms,
    timeToMinutes,
    normalizeFocusDurationMinutes,
    resolveFocusErrorMessage
} from '../utils/focusTime';
import {
    readFocusStorage,
    writeFocusStorage,
    clearFocusStorage
} from '../utils/focusStorage';

/**
 * The focus session engine: timer, persistence, and the two completion paths.
 *
 * This runs once, inside FocusProvider, so a session survives navigation
 * between /today and /focus. Mounting it per-route would tear down the ticker
 * and abandon any in-flight completion request on every navigation.
 *
 * Two modes:
 *   'task'  - bound to an ongoing schedule task; updates that task's status.
 *   'adhoc' - no schedule slot; on completion it creates a completed Task so
 *             the work still lands in today's completed list.
 */
const useFocusEngine = () => {
    const { user } = useAuth();
    const { scheduleByDate, fetchSchedule, updateScheduleTaskStatus } = useSchedule();
    const { createTask, addTaskToDate } = useTasks();

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
    const [focusCategory, setFocusCategory] = useState('');
    const [focusGoal, setFocusGoal] = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [mode, setMode] = useState('task');
    const [adHocTitle, setAdHocTitle] = useState('');
    const focusCompletingRef = useRef(false);

    // Signals for the analytics half of /focus, so the engine never has to know
    // that charts exist.
    const [sessionsVersion, setSessionsVersion] = useState(0);
    const [lastSessionResponse, setLastSessionResponse] = useState(null);

    const todayYmd = useMemo(() => toYmd(now), [now]);
    const scheduleTasks = useMemo(() => scheduleByDate[todayYmd]?.tasks || [], [scheduleByDate, todayYmd]);

    const isAdHoc = mode === 'adhoc';

    const currentTasks = useMemo(() => {
        const currentMinutes = (now.getHours() * 60) + now.getMinutes();
        return scheduleTasks.filter((task) => {
            if (isResolvedStatus(task.status)) return false;
            const startMinutes = timeToMinutes(task.slot_start_time);
            const endMinutes = timeToMinutes(task.slot_end_time);
            if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return false;
            return startMinutes <= currentMinutes && currentMinutes < endMinutes;
        });
    }, [now, scheduleTasks]);

    const selectedTask = useMemo(() => {
        if (isAdHoc) return null;
        if (selectedTaskId) {
            return scheduleTasks.find((task) => task.id === selectedTaskId) || focusTaskSnapshot || null;
        }
        return focusTaskSnapshot || null;
    }, [focusTaskSnapshot, isAdHoc, scheduleTasks, selectedTaskId]);

    const focusRemainingTaskMinutes = useMemo(() => {
        if (isAdHoc || !selectedTask?.slot_end_time) return null;
        const endMinutes = timeToMinutes(selectedTask.slot_end_time);
        if (!Number.isFinite(endMinutes)) return null;
        const currentMinutes = (now.getHours() * 60) + now.getMinutes();
        return Math.max(1, endMinutes - currentMinutes);
    }, [isAdHoc, now, selectedTask]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Gated on the user: the provider is mounted app-wide, including on the
    // login screen, where an unauthenticated fetch would 401.
    useEffect(() => {
        if (!user?.id) return;
        if (!scheduleByDate[todayYmd]) {
            fetchSchedule(todayYmd).catch(() => null);
        }
    }, [fetchSchedule, scheduleByDate, todayYmd, user?.id]);

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
            mode,
            adHocTitle,
            ...override
        };

        if (!user?.id) return;

        if (!payload.enabled && !payload.startedAt && !payload.pendingSession) {
            clearFocusStorage(user.id);
            return;
        }

        writeFocusStorage(user.id, payload);
    }, [adHocTitle, focusCategory, focusCompletionAttempted, focusDurationMinutes, focusEnabled, focusGoal, focusPausedAt, focusSessionId, focusStartedAt, focusStatus, focusTaskSnapshot, mode, pendingFocusSession, selectedTaskId, totalPausedSeconds, user?.id]);

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

    const syncPendingFocusSession = useCallback(async (sessionPayload) => {
        if (!sessionPayload || pendingSyncAttempted) return;

        setPendingSyncAttempted(true);

        try {
            const response = await analyticsService.logFocusSession(sessionPayload);
            setLastSessionResponse(response?.data || response);
            setSessionsVersion((prev) => prev + 1);
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
    }, [pendingSyncAttempted, persistFocusState]);

    const resetSessionState = useCallback(() => {
        setFocusStartedAt(null);
        setElapsedFocusSeconds(0);
        setFocusSessionId(null);
        setFocusStatus('idle');
        setFocusPausedAt(null);
        setTotalPausedSeconds(0);
        setFocusCompletionAttempted(false);
    }, []);

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
        const sessionDate = toYmd(start);
        const wasAdHoc = isAdHoc;

        setSavingFocusSession(true);
        setFocusError('');

        if (reason === 'auto') {
            setFocusCompletionAttempted(true);
            persistFocusState({ completionAttempted: true });
        }

        // Ad-hoc work has no schedule slot, so record it as a completed Task
        // first - that id is what makes the focus session traceable to work.
        // If this fails we still log the session below; never lose the time.
        let createdTaskId = null;
        if (wasAdHoc) {
            const title = adHocTitle.trim()
                || focusGoal.trim()
                || (focusCategory.trim() ? `Focus: ${focusCategory.trim()}` : 'Focus session');
            try {
                const response = await createTask({
                    title: title.slice(0, 255),
                    description: focusGoal.trim() || null,
                    category: focusCategory.trim() || null,
                    priority: 'medium',
                    status: 'completed',
                    scheduled_date: sessionDate,
                    scheduled_time: toHms(start),
                    duration_minutes: targetMinutes,
                    actual_duration_minutes: actualMinutes
                });
                const created = response?.data?.data || response?.data || response;
                createdTaskId = created?.id || null;
                if (created?.id) {
                    addTaskToDate(sessionDate, created);
                }
            } catch {
                // Fall through: the focus session is still worth logging.
            }
        }

        const sessionPayload = {
            date: sessionDate,
            start_time: toHms(start),
            end_time: toHms(end),
            duration_minutes: actualMinutes,
            target_minutes: targetMinutes,
            actual_minutes: actualMinutes,
            status,
            schedule_task_id: wasAdHoc ? null : (selectedTask?.id || null),
            task_id: createdTaskId,
            category: focusCategory.trim()
        };

        try {
            const response = await analyticsService.logFocusSession(sessionPayload);
            setLastSessionResponse(response?.data || response);
            setSessionsVersion((prev) => prev + 1);
            setFocusMessage(`Great focus sprint! Logged ${Math.min(actualMinutes, normalizedDuration)} minute(s).`);
            resetSessionState();
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

            if (!wasAdHoc && selectedTask?.id) {
                const endMinutes = timeToMinutes(selectedTask.slot_end_time);
                const currentMinutes = (new Date()).getHours() * 60 + (new Date()).getMinutes();
                const shouldComplete = Number.isFinite(endMinutes) && currentMinutes >= endMinutes;
                await updateScheduleTaskStatus(selectedTask.id, shouldComplete ? 'completed' : 'in_progress');
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
            resetSessionState();
        } finally {
            setSavingFocusSession(false);
            focusCompletingRef.current = false;
        }
    }, [addTaskToDate, adHocTitle, createTask, focusCategory, focusCompletionAttempted, focusDurationMinutes, focusGoal, focusStartedAt, getElapsedSeconds, isAdHoc, persistFocusState, resetSessionState, savingFocusSession, selectedTask, updateScheduleTaskStatus]);

    // Restore a session left behind by a refresh. Runs once per app load now
    // that the engine lives in a provider rather than on the /focus route.
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
        const storedCategory = typeof stored.category === 'string' ? stored.category : '';
        // Sessions persisted before ad-hoc mode existed have no `mode` key.
        const storedMode = stored.mode === 'adhoc' ? 'adhoc' : 'task';

        setFocusDurationMinutes(normalizedDuration);
        setFocusCategory(storedCategory);
        setCustomCategory(storedCategory && !FOCUS_CATEGORY_OPTIONS.includes(storedCategory) ? storedCategory : '');
        setFocusGoal(typeof stored.goal === 'string' ? stored.goal : '');
        setMode(storedMode);
        setAdHocTitle(typeof stored.adHocTitle === 'string' ? stored.adHocTitle : '');
        setSelectedTaskId(stored.selectedTaskId || null);
        setFocusTaskSnapshot(stored.focusTaskSnapshot || null);

        if (stored.startedAt && !hasValidStart) {
            const pendingSession = stored.pendingSession || null;
            setFocusEnabled(Boolean(stored.enabled));
            resetSessionState();
            setPendingFocusSession(pendingSession);
            setPendingSyncAttempted(false);

            if (pendingSession) {
                writeFocusStorage(user.id, {
                    enabled: Boolean(stored.enabled),
                    durationMinutes: normalizedDuration,
                    startedAt: null,
                    sessionId: null,
                    completionAttempted: false,
                    pendingSession,
                    category: storedCategory,
                    goal: typeof stored.goal === 'string' ? stored.goal : '',
                    mode: storedMode,
                    adHocTitle: typeof stored.adHocTitle === 'string' ? stored.adHocTitle : ''
                });
            } else {
                clearFocusStorage(user.id);
            }
            return;
        }

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
    }, [resetSessionState, user?.id]);

    useEffect(() => {
        if (!pendingFocusSession) return;
        syncPendingFocusSession(pendingFocusSession);
    }, [pendingFocusSession, syncPendingFocusSession]);

    // Auto-bind the sole ongoing task. Gated on task mode so an ad-hoc session
    // is never silently re-pointed at a schedule slot.
    useEffect(() => {
        if (focusStatus !== 'idle' || isAdHoc) return;
        if (currentTasks.length === 1) {
            setSelectedTaskId(currentTasks[0].id);
            setFocusTaskSnapshot(currentTasks[0]);
        }
    }, [currentTasks, focusStatus, isAdHoc]);

    useEffect(() => {
        if (focusStatus !== 'idle' || isAdHoc || !selectedTask) return;
        if (focusRemainingTaskMinutes) {
            setFocusDurationMinutes(Math.min(focusRemainingTaskMinutes, DEFAULT_FOCUS_DURATION_MINUTES));
        }
    }, [focusRemainingTaskMinutes, focusStatus, isAdHoc, selectedTask]);

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

    const handleFocusDurationChange = useCallback((event) => {
        const value = event.target.value;
        if (value === '') {
            setFocusDurationMinutes('');
            return;
        }
        if (!/^\d+$/.test(value)) return;
        setFocusDurationMinutes(value);
    }, []);

    const handleFocusDurationBlur = useCallback(() => {
        const normalized = normalizeFocusDurationMinutes(focusDurationMinutes);
        if (focusRemainingTaskMinutes) {
            setFocusDurationMinutes(Math.min(normalized, focusRemainingTaskMinutes));
            return;
        }
        setFocusDurationMinutes(normalized);
    }, [focusDurationMinutes, focusRemainingTaskMinutes]);

    const selectTask = useCallback((task) => {
        setSelectedTaskId(task?.id || null);
        setFocusTaskSnapshot(task || null);
    }, []);

    const changeMode = useCallback((nextMode) => {
        if (focusStatus !== 'idle') return;
        setMode(nextMode === 'adhoc' ? 'adhoc' : 'task');
        setFocusError('');
        setFocusMessage('');
    }, [focusStatus]);

    const startFocusMode = useCallback(async () => {
        if (!focusEnabled) {
            setFocusError('Enable focus mode first.');
            return;
        }

        if (focusStartedAt || savingFocusSession || focusStatus !== 'idle') return;

        if (isAdHoc) {
            if (!adHocTitle.trim()) {
                setFocusError('Name what you are focusing on to start.');
                return;
            }
        } else {
            if (!selectedTask || !currentTasks.some((task) => task.id === selectedTask.id)) {
                setFocusError('Select an active task to start focus.');
                return;
            }
            if (isResolvedStatus(selectedTask.status)) {
                setFocusError('Resolved tasks cannot enter focus mode.');
                return;
            }
        }

        const normalizedDuration = normalizeFocusDurationMinutes(focusDurationMinutes);
        const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        setFocusError('');
        setFocusMessage('');
        setFocusDurationMinutes(focusRemainingTaskMinutes
            ? Math.min(normalizedDuration, focusRemainingTaskMinutes)
            : normalizedDuration);
        setFocusStartedAt(Date.now());
        setFocusSessionId(sessionId);
        setFocusStatus('running');
        setFocusPausedAt(null);
        setTotalPausedSeconds(0);
        setFocusCompletionAttempted(false);
        setPendingFocusSession(null);
        setPendingSyncAttempted(false);
        setElapsedFocusSeconds(0);

        if (!isAdHoc) {
            setFocusTaskSnapshot(selectedTask);
            if (selectedTask.status === 'pending') {
                try {
                    await updateScheduleTaskStatus(selectedTask.id, 'in_progress');
                } catch {
                    setFocusError('Unable to update task status for focus mode.');
                }
            }
        }
    }, [adHocTitle, currentTasks, focusDurationMinutes, focusEnabled, focusRemainingTaskMinutes, focusStartedAt, focusStatus, isAdHoc, savingFocusSession, selectedTask, updateScheduleTaskStatus]);

    const stopFocusMode = useCallback(async () => {
        if (!focusStartedAt) {
            resetSessionState();
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
    }, [completeFocusSession, focusStartedAt, persistFocusState, resetSessionState]);

    const pauseFocusMode = useCallback(() => {
        if (focusStatus !== 'running' || !focusStartedAt) return;
        setElapsedFocusSeconds(getElapsedSeconds());
        setFocusStatus('paused');
        setFocusPausedAt(Date.now());
    }, [focusStartedAt, focusStatus, getElapsedSeconds]);

    const resumeFocusMode = useCallback(() => {
        if (focusStatus !== 'paused' || !focusStartedAt || !focusPausedAt) return;
        const pausedSeconds = Math.max(0, Math.floor((Date.now() - focusPausedAt) / 1000));
        setTotalPausedSeconds((prev) => prev + pausedSeconds);
        setFocusPausedAt(null);
        setFocusStatus('running');
    }, [focusPausedAt, focusStartedAt, focusStatus]);

    const toggleFocusEnabled = useCallback(async (enabled) => {
        if (savingFocusSession) return;

        setFocusError('');
        setFocusMessage('');

        if (!enabled && focusStartedAt) {
            await stopFocusMode();
        }

        setFocusEnabled(enabled);
    }, [focusStartedAt, savingFocusSession, stopFocusMode]);

    return {
        // session state
        focusEnabled,
        focusStatus,
        focusStartedAt,
        focusDurationMinutes,
        elapsedFocusSeconds,
        focusRemainingSeconds,
        focusProgressPercent,
        projectedEndTime,
        savingFocusSession,
        focusError,
        focusMessage,
        maxDurationMinutes: focusRemainingTaskMinutes || MAX_FOCUS_DURATION_MINUTES,

        // task binding
        mode,
        isAdHoc,
        adHocTitle,
        setAdHocTitle,
        changeMode,
        currentTasks,
        selectedTask,
        selectedTaskId,
        selectTask,
        focusRemainingTaskMinutes,

        // session metadata
        focusCategory,
        setFocusCategory,
        customCategory,
        setCustomCategory,
        focusGoal,
        setFocusGoal,

        // controls
        handleFocusDurationChange,
        handleFocusDurationBlur,
        startFocusMode,
        stopFocusMode,
        pauseFocusMode,
        resumeFocusMode,
        toggleFocusEnabled,

        // signals for the analytics page
        sessionsVersion,
        lastSessionResponse
    };
};

export default useFocusEngine;
