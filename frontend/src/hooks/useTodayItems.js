import { useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSchedule } from '../context/ScheduleContext';
import { useRoutine } from '../context/RoutineContext';
import { useTasks } from '../context/TaskContext';
import taskService from '../services/taskService';
import { normalizeDayItem } from '../utils/dayItems';

/**
 * The one place that answers "what is on today".
 *
 * Today's Dashboard renders it; the notification engine schedules against it.
 * Both need the same merge of schedule tasks + free-form tasks + routine
 * instances, so it lives here rather than being derived twice and drifting.
 *
 * This hook owns no state of its own - everything is derived from the three
 * context caches, which stay the single source of truth.
 */

export const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * @param {Object}  options
 * @param {Date}    options.now        ticking clock, so todayYmd rolls at midnight
 * @param {Boolean} options.autoFetch  whether this consumer owns the network calls
 */
const useTodayItems = ({ now, autoFetch = false } = {}) => {
    const { user } = useAuth();
    const {
        scheduleByDate,
        loading,
        error,
        fetchSchedule,
        updateScheduleTaskStatus,
        patchTaskFromRoutineItem
    } = useSchedule();
    const {
        dailyByDate,
        fetchDailyRoutine,
        completeInstanceItem,
        patchItemFromScheduleTask
    } = useRoutine();
    const { tasksByDate, fetchTasksForDate, patchTaskInDate } = useTasks();

    const todayYmd = useMemo(() => toYmd(now), [now]);

    const cachedSchedule = scheduleByDate[todayYmd];
    const scheduleTasks = useMemo(() => cachedSchedule?.tasks || [], [cachedSchedule]);
    const dailyRoutine = dailyByDate[todayYmd];
    const routineInstances = useMemo(() => dailyRoutine?.routines || [], [dailyRoutine]);
    const dayTasks = useMemo(() => tasksByDate[todayYmd] || [], [tasksByDate, todayYmd]);

    /**
     * Exactly one consumer may autoFetch. Two of them racing on the same mount
     * tick would fire duplicate requests, and reading a date materializes
     * routine slots server-side - so a duplicate read is a duplicate write.
     */
    useEffect(() => {
        if (!autoFetch || !user?.id) return;
        if (!cachedSchedule) fetchSchedule(todayYmd).catch(() => null);
    }, [autoFetch, cachedSchedule, fetchSchedule, todayYmd, user?.id]);

    useEffect(() => {
        if (!autoFetch || !user?.id) return;
        if (!dailyRoutine) fetchDailyRoutine(todayYmd).catch(() => null);
    }, [autoFetch, dailyRoutine, fetchDailyRoutine, todayYmd, user?.id]);

    useEffect(() => {
        if (!autoFetch || !user?.id) return;
        if (!tasksByDate[todayYmd]) fetchTasksForDate(todayYmd).catch(() => null);
    }, [autoFetch, fetchTasksForDate, tasksByDate, todayYmd, user?.id]);

    // Safety net for the two caches drifting: any tab switch or refocus
    // re-reads the day, covering multi-tab edits and any missed local patch.
    useEffect(() => {
        if (!autoFetch || !user?.id) return undefined;
        const refresh = () => {
            if (document.visibilityState !== 'visible') return;
            fetchSchedule(todayYmd).catch(() => null);
            fetchDailyRoutine(todayYmd).catch(() => null);
            fetchTasksForDate(todayYmd).catch(() => null);
        };
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [autoFetch, fetchDailyRoutine, fetchSchedule, fetchTasksForDate, todayYmd, user?.id]);

    /** Routine instance name by id, for the pill on routine-derived tasks. */
    const routineNameById = useMemo(() => {
        const map = {};
        routineInstances.forEach((instance) => { map[instance.id] = instance.name; });
        return map;
    }, [routineInstances]);

    /**
     * Routine items that never became schedule tasks - computeItemSlot could
     * not resolve a time for them, so they would otherwise vanish from the day.
     */
    const unscheduledRoutineItems = useMemo(() => (
        routineInstances.flatMap((instance) => (
            (instance.items || [])
                .filter((item) => !item.scheduled_task_id)
                .map((item) => ({ ...item, instanceId: instance.id, routineName: instance.name }))
        ))
    ), [routineInstances]);

    const dayItems = useMemo(() => ([
        ...scheduleTasks.map((task) => normalizeDayItem(task, 'schedule')),
        ...dayTasks.map((task) => normalizeDayItem(task, 'task'))
    ].filter(Boolean)), [dayTasks, scheduleTasks]);

    /**
     * Route the status write by record type, then cross-patch the routine
     * cache so /routines does not drift until a reload. The server already
     * writes both sides; this only keeps the client in step.
     */
    const handleStatusUpdate = useCallback(async (item, status) => {
        try {
            if (item.kind === 'schedule') {
                const updated = await updateScheduleTaskStatus(item.id, status);
                if (updated?.routine_instance_id && patchItemFromScheduleTask) {
                    patchItemFromScheduleTask(updated);
                }
            } else {
                const response = await taskService.updateStatus(item.id, status);
                const updated = response?.data?.data || response?.data || response;
                patchTaskInDate(todayYmd, updated?.id ? updated : { ...item.raw, status });
            }
        } catch (updateError) {
            console.error('Failed to update task status:', updateError);
        }
    }, [patchItemFromScheduleTask, patchTaskInDate, todayYmd, updateScheduleTaskStatus]);

    const handleRoutineStatusUpdate = useCallback(async (instanceId, itemId, status) => {
        try {
            const updated = await completeInstanceItem(instanceId, itemId, status);
            const items = updated?.items || [];
            const changed = items.find((entry) => entry.id === itemId);
            if (changed?.scheduled_task_id && patchTaskFromRoutineItem) {
                patchTaskFromRoutineItem(todayYmd, changed);
            }
        } catch (updateError) {
            console.error('Failed to update routine item status:', updateError);
        }
    }, [completeInstanceItem, patchTaskFromRoutineItem, todayYmd]);

    return {
        todayYmd,
        dayItems,
        routineInstances,
        unscheduledRoutineItems,
        routineNameById,
        handleStatusUpdate,
        handleRoutineStatusUpdate,
        loading,
        error,
        // The engine must not evaluate an empty day before the fetch lands.
        hydrated: Boolean(cachedSchedule)
    };
};

export default useTodayItems;
