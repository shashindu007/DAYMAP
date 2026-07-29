import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchedule } from '../context/ScheduleContext';
import { useRoutine } from '../context/RoutineContext';
import { useTasks } from '../context/TaskContext';
import { useScheduleEditor } from '../context/ScheduleEditorContext';
import Button from '../components/common/Button';
import TaskCard from '../components/tasks/TaskCard';
import TaskSection from '../components/tasks/TaskSection';
import FocusSessionPanel from '../components/focus/FocusSessionPanel';
import taskService from '../services/taskService';
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from '../utils/taskStatus';
import {
    normalizeDayItem,
    bucketDayItems,
    getProgressPercent,
    formatDisplayTime
} from '../utils/dayItems';
import './TodayView.css';

const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const TodayView = () => {
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
    const { openEditor } = useScheduleEditor();
    const navigate = useNavigate();

    const [now, setNow] = useState(new Date());
    const [showDone, setShowDone] = useState(false);
    const todayYmd = useMemo(() => toYmd(now), [now]);

    const cachedSchedule = scheduleByDate[todayYmd];
    const scheduleTasks = useMemo(() => cachedSchedule?.tasks || [], [cachedSchedule]);
    const dailyRoutine = dailyByDate[todayYmd];
    const routineInstances = useMemo(() => dailyRoutine?.routines || [], [dailyRoutine]);
    const dayTasks = useMemo(() => tasksByDate[todayYmd] || [], [tasksByDate, todayYmd]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!cachedSchedule) fetchSchedule(todayYmd).catch(() => null);
    }, [fetchSchedule, todayYmd, cachedSchedule]);

    useEffect(() => {
        if (!dailyRoutine) fetchDailyRoutine(todayYmd).catch(() => null);
    }, [fetchDailyRoutine, todayYmd, dailyRoutine]);

    useEffect(() => {
        if (!tasksByDate[todayYmd]) fetchTasksForDate(todayYmd).catch(() => null);
    }, [fetchTasksForDate, tasksByDate, todayYmd]);

    // Safety net for the two caches drifting: any tab switch or refocus
    // re-reads the day, covering multi-tab edits and any missed local patch.
    useEffect(() => {
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
    }, [fetchDailyRoutine, fetchSchedule, fetchTasksForDate, todayYmd]);

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

    const nowMinutes = useMemo(() => (now.getHours() * 60) + now.getMinutes(), [now]);

    const buckets = useMemo(() => bucketDayItems(dayItems, nowMinutes), [dayItems, nowMinutes]);

    const stats = useMemo(() => {
        const total = dayItems.length;
        const completed = buckets.completed.length;
        return {
            total,
            completed,
            remaining: Math.max(total - completed, 0),
            percentage: total > 0 ? (completed / total) * 100 : 0
        };
    }, [buckets.completed.length, dayItems.length]);

    /**
     * Everything that is still ahead of you, in one time-ordered list:
     * timed upcoming slots, then untimed "anytime" work, then routine items
     * that never resolved to a slot. Splitting these across three sections
     * meant the answer to "what's next" was in three places.
     */
    const upNext = useMemo(() => ([
        ...buckets.upcoming,
        ...buckets.anytime
    ]), [buckets.anytime, buckets.upcoming]);

    const nextStartLabel = useMemo(() => (
        buckets.upcoming.find((item) => item.startLabel)?.startLabel || null
    ), [buckets.upcoming]);

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

    const reviewActions = useCallback((item) => ([
        {
            key: 'complete',
            label: 'Complete',
            variant: 'primary',
            onClick: () => handleStatusUpdate(item, 'completed')
        },
        {
            key: 'missed',
            label: "Didn't do it",
            variant: 'secondary',
            onClick: () => handleStatusUpdate(item, 'missed')
        }
    ]), [handleStatusUpdate]);

    const undoAction = useCallback((item) => ([
        {
            key: 'reopen',
            label: 'Reopen',
            variant: 'secondary',
            onClick: () => handleStatusUpdate(item, 'pending')
        }
    ]), [handleStatusUpdate]);

    const routineNameFor = (item) => (item.isRoutine ? routineNameById[item.routineInstanceId] : null);

    const isInitialLoading = loading && !cachedSchedule;
    const hasAnything = dayItems.length > 0 || unscheduledRoutineItems.length > 0;

    const doneCount = buckets.completed.length + buckets.incomplete.length;

    return (
        <div className="today-container">
            <div className="today-header">
                <div className="today-header-top">
                    <div>
                        <h1>Today's Dashboard</h1>
                        <p className="today-subtitle">Stay on track with a real-time view of today’s tasks.</p>
                    </div>
                    <div className="today-actions">
                        <Button variant="secondary" onClick={() => openEditor(todayYmd)}>
                            Edit Schedule
                        </Button>
                    </div>
                </div>

                {/* One line, not a stat grid plus a bar chart. The four-bar
                    chart that used to sit here restated this progress bar. */}
                <div className="today-summary">
                    <p className="today-summary-count">
                        <strong>{stats.completed}</strong>
                        <span>of {stats.total} done</span>
                    </p>
                    <div className="today-summary-bar">
                        <div className="progress-bar">
                            <div
                                className="progress-fill progress-fill--success"
                                style={{ width: `${stats.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                    {nextStartLabel && (
                        <p className="today-summary-next">
                            Next at <strong>{nextStartLabel}</strong>
                        </p>
                    )}
                </div>
            </div>

            {error && <p className="alert alert-error">{error}</p>}

            <FocusSessionPanel
                variant="compact"
                boundTask={buckets.current[0]?.kind === 'schedule' ? buckets.current[0].raw : null}
                showTaskPicker={false}
                onOpenFullView={() => navigate('/focus')}
            />

            <div className="tasks-list">
                {isInitialLoading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                    </div>
                ) : !hasAnything ? (
                    <div className="empty-state">
                        <p>No scheduled slots for today yet.</p>
                        <Button variant="primary" onClick={() => openEditor(todayYmd)}>
                            Schedule Today
                        </Button>
                    </div>
                ) : (
                    <>
                        <TaskSection
                            title="Happening Now"
                            subtitle="Active right now"
                            count={buckets.current.length}
                            emptyText="No active task for the current time slot."
                            alwaysShow
                        >
                            {buckets.current.map((item) => (
                                <TaskCard
                                    key={item.key}
                                    item={item}
                                    variant="current"
                                    badge={{ label: 'Now', className: 'status-current' }}
                                    progressPercent={getProgressPercent(item, nowMinutes)}
                                    routineName={routineNameFor(item)}
                                    actions={reviewActions(item)}
                                    hint="Finished early? Mark it now — otherwise it moves to Needs Review."
                                />
                            ))}
                        </TaskSection>

                        <TaskSection
                            title="Needs Review"
                            subtitle="Time has passed — did these happen?"
                            count={buckets.needsReview.length}
                            emptyText="Nothing waiting on you."
                            modifier="task-section--review"
                        >
                            {buckets.needsReview.map((item) => (
                                <TaskCard
                                    key={item.key}
                                    item={item}
                                    variant="review"
                                    badge={{ label: 'Needs review', className: 'status-review' }}
                                    progressPercent={100}
                                    routineName={routineNameFor(item)}
                                    actions={reviewActions(item)}
                                />
                            ))}
                        </TaskSection>

                        {/* Upcoming, Anytime and unscheduled routine items were
                            three separate sections answering the same question. */}
                        <TaskSection
                            title="Up next"
                            subtitle="Still ahead of you today"
                            count={upNext.length + unscheduledRoutineItems.length}
                            emptyText="Nothing left on the schedule."
                            alwaysShow
                        >
                            {upNext.map((item) => (
                                <TaskCard
                                    key={item.key}
                                    item={item}
                                    variant={item.startLabel ? 'upcoming' : 'anytime'}
                                    badge={item.startLabel
                                        ? { label: 'Upcoming', className: 'status-upcoming' }
                                        : { label: 'Anytime', className: 'status-anytime' }}
                                    routineName={routineNameFor(item)}
                                    actions={reviewActions(item)}
                                />
                            ))}

                            {unscheduledRoutineItems.map((item) => (
                                <TaskCard
                                    key={`routine:${item.instanceId}:${item.id}`}
                                    item={{
                                        title: item.title,
                                        description: item.notes,
                                        status: item.status,
                                        durationMinutes: item.duration_minutes,
                                        startLabel: item.start_time ? formatDisplayTime(item.start_time) : null
                                    }}
                                    variant="anytime"
                                    badge={{ label: 'Routine', className: 'status-anytime' }}
                                    routineName={item.routineName}
                                    actions={item.status === 'completed' || item.status === 'skipped' ? [] : [
                                        {
                                            key: 'complete',
                                            label: 'Complete',
                                            variant: 'primary',
                                            onClick: () => handleRoutineStatusUpdate(item.instanceId, item.id, 'completed')
                                        },
                                        {
                                            key: 'skip',
                                            label: 'Skip',
                                            variant: 'secondary',
                                            onClick: () => handleRoutineStatusUpdate(item.instanceId, item.id, 'skipped')
                                        }
                                    ]}
                                />
                            ))}
                        </TaskSection>

                        {/* Settled work, folded away. It is a record, not
                            something you need to act on. */}
                        {doneCount > 0 && (
                            <div className="today-done">
                                <button
                                    type="button"
                                    className="today-done-toggle"
                                    aria-expanded={showDone}
                                    onClick={() => setShowDone((open) => !open)}
                                >
                                    Done today
                                    <span className="today-done-summary">
                                        {buckets.completed.length} done
                                        {buckets.incomplete.length > 0 && ` · ${buckets.incomplete.length} missed`}
                                    </span>
                                    <span className="today-done-chevron" aria-hidden>▼</span>
                                </button>

                                {showDone && (
                                    <div className="today-done-body">
                                        {buckets.completed.map((item) => (
                                            <TaskCard
                                                key={item.key}
                                                item={item}
                                                variant="completed"
                                                badge={{ label: 'Complete', className: 'status-completed' }}
                                                routineName={routineNameFor(item)}
                                                actions={undoAction(item)}
                                            />
                                        ))}

                                        {buckets.incomplete.map((item) => (
                                            <TaskCard
                                                key={item.key}
                                                item={item}
                                                variant="missed"
                                                badge={{
                                                    label: STATUS_LABELS[item.status] || 'Missed',
                                                    className: STATUS_BADGE_CLASSES[item.status] || 'status-missed'
                                                }}
                                                routineName={routineNameFor(item)}
                                                actions={[
                                                    {
                                                        key: 'complete',
                                                        label: 'Actually did it',
                                                        variant: 'primary',
                                                        onClick: () => handleStatusUpdate(item, 'completed')
                                                    },
                                                    ...undoAction(item)
                                                ]}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default TodayView;
