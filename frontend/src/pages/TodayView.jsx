import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchedule } from '../context/ScheduleContext';
import { useRoutine } from '../context/RoutineContext';
import { useTasks } from '../context/TaskContext';
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
    const navigate = useNavigate();

    const [now, setNow] = useState(new Date());
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

    const analytics = useMemo(() => {
        const completedCount = buckets.completed.length;
        const incompleteCount = buckets.incomplete.length;
        const reviewCount = buckets.needsReview.length;
        const upcomingCount = buckets.upcoming.length;
        return {
            completedCount,
            incompleteCount,
            reviewCount,
            upcomingCount,
            maxValue: Math.max(completedCount, incompleteCount, reviewCount, upcomingCount, 1)
        };
    }, [buckets]);

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

    return (
        <div className="today-container">
            <div className="today-header">
                <div className="today-header-top">
                    <div>
                        <h1>Today's Dashboard</h1>
                        <p className="today-subtitle">Stay on track with a real-time view of today’s tasks.</p>
                    </div>
                    <div className="today-actions">
                        <Button variant="secondary" onClick={() => navigate(`/dashboard?edit=${todayYmd}`)}>
                            Edit Schedule
                        </Button>
                    </div>
                </div>

                <div className="today-hero">
                    <div className="stats">
                        <div className="stat-item">
                            <span className="stat-value">{stats.completed}</span>
                            <span className="stat-label">Completed</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{stats.remaining}</span>
                            <span className="stat-label">Remaining</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{stats.total}</span>
                            <span className="stat-label">Total tasks</span>
                        </div>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${stats.percentage}%` }}></div>
                        </div>
                    </div>

                    <div className="today-chart">
                        <div className="chart-header">
                            <div>
                                <h3>Today’s Task Analytics</h3>
                                <p>Completed vs incomplete vs review vs upcoming</p>
                            </div>
                            <span className="chart-total">{stats.total} tasks</span>
                        </div>
                        <div className="chart-bars">
                            <div className="chart-bar">
                                <span
                                    className="chart-bar-fill chart-bar-completed"
                                    style={{ height: `${(analytics.completedCount / analytics.maxValue) * 100}%` }}
                                ></span>
                                <span className="chart-bar-label">Completed</span>
                                <span className="chart-bar-value">{analytics.completedCount}</span>
                            </div>
                            <div className="chart-bar">
                                <span
                                    className="chart-bar-fill chart-bar-incomplete"
                                    style={{ height: `${(analytics.incompleteCount / analytics.maxValue) * 100}%` }}
                                ></span>
                                <span className="chart-bar-label">Incomplete</span>
                                <span className="chart-bar-value">{analytics.incompleteCount}</span>
                            </div>
                            <div className="chart-bar">
                                <span
                                    className="chart-bar-fill chart-bar-review"
                                    style={{ height: `${(analytics.reviewCount / analytics.maxValue) * 100}%` }}
                                ></span>
                                <span className="chart-bar-label">Review</span>
                                <span className="chart-bar-value">{analytics.reviewCount}</span>
                            </div>
                            <div className="chart-bar">
                                <span
                                    className="chart-bar-fill chart-bar-upcoming"
                                    style={{ height: `${(analytics.upcomingCount / analytics.maxValue) * 100}%` }}
                                ></span>
                                <span className="chart-bar-label">Upcoming</span>
                                <span className="chart-bar-value">{analytics.upcomingCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && <p className="today-error">{error}</p>}

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
                        <Button variant="primary" onClick={() => navigate(`/dashboard?edit=${todayYmd}`)}>
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

                        <TaskSection
                            title="Upcoming Tasks"
                            subtitle="Next on your schedule"
                            count={buckets.upcoming.length}
                            emptyText="No upcoming tasks scheduled."
                            alwaysShow
                        >
                            {buckets.upcoming.map((item) => (
                                <TaskCard
                                    key={item.key}
                                    item={item}
                                    variant="upcoming"
                                    badge={{ label: 'Upcoming', className: 'status-upcoming' }}
                                    progressPercent={0}
                                    routineName={routineNameFor(item)}
                                    actions={[{
                                        key: 'edit',
                                        label: 'Edit Details',
                                        variant: 'secondary',
                                        onClick: () => navigate(`/dashboard?edit=${todayYmd}`)
                                    }]}
                                />
                            ))}
                        </TaskSection>

                        <TaskSection
                            title="Completed"
                            subtitle="Done today"
                            count={buckets.completed.length}
                            emptyText="Nothing completed yet."
                            alwaysShow
                        >
                            {buckets.completed.map((item) => (
                                <TaskCard
                                    key={item.key}
                                    item={item}
                                    variant="completed"
                                    badge={{ label: 'Complete', className: 'status-completed' }}
                                    progressPercent={100}
                                    routineName={routineNameFor(item)}
                                    actions={undoAction(item)}
                                />
                            ))}
                        </TaskSection>

                        <TaskSection
                            title="Incomplete"
                            subtitle="Marked as not done"
                            count={buckets.incomplete.length}
                            emptyText="Nothing marked incomplete."
                        >
                            {buckets.incomplete.map((item) => (
                                <TaskCard
                                    key={item.key}
                                    item={item}
                                    variant="missed"
                                    badge={{
                                        label: STATUS_LABELS[item.status] || 'Missed',
                                        className: STATUS_BADGE_CLASSES[item.status] || 'status-missed'
                                    }}
                                    progressPercent={100}
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
                        </TaskSection>

                        <TaskSection
                            title="Anytime"
                            subtitle="No fixed time"
                            count={buckets.anytime.length}
                            emptyText="Nothing without a time."
                        >
                            {buckets.anytime.map((item) => (
                                <TaskCard
                                    key={item.key}
                                    item={item}
                                    variant="anytime"
                                    badge={{ label: 'Anytime', className: 'status-upcoming' }}
                                    routineName={routineNameFor(item)}
                                    actions={reviewActions(item)}
                                />
                            ))}
                        </TaskSection>

                        <TaskSection
                            title="Unscheduled Routine Items"
                            subtitle="No resolvable time — track them here"
                            count={unscheduledRoutineItems.length}
                            emptyText=""
                        >
                            {unscheduledRoutineItems.map((item) => (
                                <div
                                    key={`routine:${item.instanceId}:${item.id}`}
                                    className={`task-item task-item--anytime ${item.status === 'completed' ? 'completed' : ''}`}
                                >
                                    <div className="task-content">
                                        <div className="task-title-row">
                                            <h3 className="task-title">{item.title}</h3>
                                            <span className="task-status-badge status-upcoming">
                                                {item.status === 'completed'
                                                    ? 'Done'
                                                    : item.status === 'skipped' ? 'Skipped' : 'Routine'}
                                            </span>
                                        </div>
                                        {item.notes && <p className="task-description">{item.notes}</p>}
                                        <div className="task-meta">
                                            {item.duration_minutes && (
                                                <span className="task-duration">⏱ {item.duration_minutes} min</span>
                                            )}
                                            {item.start_time && (
                                                <span className="task-time">⏰ {formatDisplayTime(item.start_time)}</span>
                                            )}
                                            <span className="task-badge-routine">🔁 {item.routineName}</span>
                                        </div>
                                        <div className="task-actions">
                                            <Button
                                                variant="primary"
                                                className="task-action-btn"
                                                onClick={() => handleRoutineStatusUpdate(item.instanceId, item.id, 'completed')}
                                            >
                                                Complete
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                className="task-action-btn"
                                                onClick={() => handleRoutineStatusUpdate(item.instanceId, item.id, 'skipped')}
                                            >
                                                Skip
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </TaskSection>
                    </>
                )}
            </div>
        </div>
    );
};

export default TodayView;
