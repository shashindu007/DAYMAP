import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScheduleEditor } from '../context/ScheduleEditorContext';
import useTodayItems from '../hooks/useTodayItems';
import Button from '../components/common/Button';
import TaskCard from '../components/tasks/TaskCard';
import TaskSection from '../components/tasks/TaskSection';
import TodayGlance from '../components/today/TodayGlance';
import FocusSessionPanel from '../components/focus/FocusSessionPanel';
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from '../utils/taskStatus';
import {
    bucketDayItems,
    getProgressPercent,
    formatDisplayTime
} from '../utils/dayItems';
import './TodayView.css';

const TodayView = () => {
    const { openEditor } = useScheduleEditor();
    const navigate = useNavigate();

    const [now, setNow] = useState(new Date());
    const [showDone, setShowDone] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    /**
     * autoFetch stays off here: NotificationProvider sits above every private
     * route and already owns the fetching, so claiming it again would double
     * every request on mount.
     */
    const {
        todayYmd,
        dayItems,
        unscheduledRoutineItems,
        routineNameById,
        handleStatusUpdate,
        handleRoutineStatusUpdate,
        loading,
        error,
        hydrated
    } = useTodayItems({ now });

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

    const isInitialLoading = loading && !hydrated;
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
                    <TodayGlance items={dayItems} nowMinutes={nowMinutes} />
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
