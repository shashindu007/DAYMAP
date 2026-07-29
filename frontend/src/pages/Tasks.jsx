import React, { useEffect, useMemo, useState } from 'react';
import { useTasks } from '../context/TaskContext';
import Button from '../components/common/Button';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useScheduleEditor } from '../context/ScheduleEditorContext';
import TaskCard from '../components/tasks/TaskCard';
import './Tasks.css';

const DAY_WINDOW = 7;
const HOURS_24_MS = 24 * 60 * 60 * 1000;

const toYmd = (date) => date.toISOString().split('T')[0];

const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const getTaskDateTime = (task) => {
    if (!task?.scheduled_date) return null;
    const time = task?.scheduled_time ? task.scheduled_time.slice(0, 5) : '00:00';
    return new Date(`${task.scheduled_date}T${time}:00`);
};

const formatDateLabel = (dateString) => {
    if (!dateString) return '';
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};

const getRelativeLabel = (dateString) => {
    if (!dateString) return '';
    const date = new Date(`${dateString}T00:00:00`);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.round((date - startOfToday) / (24 * 60 * 60 * 1000));

    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    return `In ${diffDays} days`;
};

const Tasks = () => {
    const { openEditor } = useScheduleEditor();
    const { tasks, loading, error, fetchTasks, updateTask, deleteTask } = useTasks();
    const [statusFilter, setStatusFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('all');
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const formatDisplayTime = (timeValue) => {
        if (!timeValue) return '';
        return timeValue.length >= 5 ? timeValue.slice(0, 5) : timeValue;
    };

    useEffect(() => {
        const loadTasks = async () => {
            try {
                const today = new Date();
                const endDate = toYmd(today);
                const startDate = toYmd(addDays(today, -(DAY_WINDOW - 1)));
                await fetchTasks({ date_from: startDate, date_to: endDate });
            } catch (loadError) {
                console.error('Failed to load tasks:', loadError);
            }
        };

        loadTasks();
    }, [fetchTasks]);

    const handleStatusChange = async (task, nextStatus) => {
        try {
            await updateTask(task.id, { status: nextStatus });
        } catch (updateError) {
            console.error('Failed to update task status:', updateError);
        }
    };

    const handleConfirmDelete = async () => {
        if (!pendingDelete) return;
        try {
            setDeleting(true);
            await deleteTask(pendingDelete.id);
            setPendingDelete(null);
        } catch (deleteError) {
            console.error('Failed to delete task:', deleteError);
        } finally {
            setDeleting(false);
        }
    };

    const handleClearFilters = () => {
        setStatusFilter('all');
        setQuery('');
        setDateFilter('all');
    };

    const last7Days = useMemo(() => {
        const today = new Date();
        return Array.from({ length: DAY_WINDOW }, (_, index) => addDays(today, -index));
    }, []);

    const last7DayStrings = useMemo(
        () => last7Days.map((date) => toYmd(date)),
        [last7Days]
    );

    const filteredTasks = useMemo(() => (
        tasks.filter((task) => {
            const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
            const normalizedQuery = query.trim().toLowerCase();
            const matchesQuery =
                !normalizedQuery ||
                task.title.toLowerCase().includes(normalizedQuery) ||
                (task.description || '').toLowerCase().includes(normalizedQuery);
            const matchesDateWindow = task.scheduled_date && last7DayStrings.includes(task.scheduled_date);

            return matchesStatus && matchesQuery && matchesDateWindow;
        })
    ), [tasks, statusFilter, query, last7DayStrings]);

    const groupedTasks = useMemo(() => {
        const groups = new Map();
        filteredTasks.forEach((task) => {
            const dateKey = task.scheduled_date;
            if (!dateKey) return;
            if (dateFilter !== 'all' && dateKey !== dateFilter) return;
            if (!groups.has(dateKey)) groups.set(dateKey, []);
            groups.get(dateKey).push(task);
        });

        return last7DayStrings
            .filter((dateKey) => groups.has(dateKey))
            .map((dateKey) => ({
                date: dateKey,
                tasks: groups.get(dateKey).sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))
            }));
    }, [filteredTasks, dateFilter, last7DayStrings]);

    /* Filters used to give no feedback at all — with only per-day counts you
       could not tell how much a filter had hidden. */
    const visibleTaskCount = useMemo(
        () => groupedTasks.reduce((sum, group) => sum + group.tasks.length, 0),
        [groupedTasks]
    );

    /**
     * Why a task can't be completed from here, or null when it can.
     * The button used to disable for two different reasons and explain only
     * one of them ("unlocks after 24 hours" — never true for a stale task,
     * and simply wrong for one that hasn't started yet).
     */
    const completeBlockedReason = (task) => {
        if (task.status === 'completed') return null;
        const taskDateTime = getTaskDateTime(task);
        if (!taskDateTime) return null;
        const diff = new Date() - taskDateTime;
        if (diff < 0) return "Hasn't started yet.";
        if (diff > HOURS_24_MS) return 'Too old to change — the 24-hour window has passed.';
        return null;
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return { label: 'Complete', className: 'status-completed' };
            case 'cancelled':
                return { label: 'Cancelled', className: 'status-incomplete' };
            case 'in_progress':
                return { label: 'In progress', className: 'status-upcoming' };
            default:
                return { label: 'Pending', className: 'status-anytime' };
        }
    };

    return (
        <div className="tasks-page">
            {/* Named for what it actually is. The fetch and the filter are both
                hard-locked to DAY_WINDOW, so "All Tasks" was never true. */}
            <div className="tasks-page-header">
                <div>
                    <h1>Task log</h1>
                    <p className="tasks-subtitle">The last {DAY_WINDOW} days.</p>
                </div>
                <div className="tasks-header-actions">
                    <Button variant="primary" onClick={() => openEditor()}>
                        New task
                    </Button>
                </div>
            </div>

            <div className="tasks-toolbar">
                <input
                    className="tasks-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by title or description"
                />
                <select
                    className="tasks-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <select
                    className="tasks-filter"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                >
                    {/* "Last 7 days" as the reset option, sitting among seven
                        specific dates, read like a range rather than "no filter". */}
                    <option value="all">Any day</option>
                    {last7DayStrings.map((date) => (
                        <option key={date} value={date}>
                            {formatDateLabel(date)}
                        </option>
                    ))}
                </select>
                <Button variant="outline" onClick={handleClearFilters}>
                    Clear filters
                </Button>
            </div>

            <p className="tasks-result-count" aria-live="polite">
                {loading
                    ? 'Loading tasks…'
                    : `${visibleTaskCount} task${visibleTaskCount === 1 ? '' : 's'}`}
            </p>

            {error && (
                <p className="alert alert-error" role="alert" aria-live="polite">
                    {error}
                </p>
            )}

            {!loading && visibleTaskCount === 0 && (
                <div className="empty-state">
                    <p>No tasks match these filters.</p>
                    <Button variant="primary" onClick={() => openEditor()}>
                        Create a task
                    </Button>
                </div>
            )}

            <div className="tasks-list">
                {groupedTasks.map((group) => (
                    <section key={group.date} className="task-section tasks-day-group">
                        <div className="task-section-header tasks-day-header">
                            <div>
                                <h2 className="tasks-day-title">{getRelativeLabel(group.date)}</h2>
                                <span className="tasks-day-subtitle">{formatDateLabel(group.date)}</span>
                            </div>
                            <span className="task-section-count">{group.tasks.length}</span>
                        </div>
                        <div className="task-section-body">
                            {group.tasks.map((task) => {
                                const blockedReason = completeBlockedReason(task);
                                const isDone = task.status === 'completed';
                                return (
                                    <TaskCard
                                        key={task.id}
                                        item={{
                                            title: task.title,
                                            description: task.description,
                                            status: task.status,
                                            priority: task.priority,
                                            durationMinutes: task.duration_minutes,
                                            // No date here: the group header
                                            // above already gives it twice.
                                            startLabel: task.scheduled_time
                                                ? formatDisplayTime(task.scheduled_time)
                                                : null
                                        }}
                                        variant={isDone ? 'completed' : 'upcoming'}
                                        badge={getStatusBadge(task.status)}
                                        hint={!isDone ? blockedReason : null}
                                        actions={[
                                            ...(isDone ? [] : [{
                                                key: 'done',
                                                label: 'Mark done',
                                                variant: 'primary',
                                                disabled: Boolean(blockedReason),
                                                onClick: () => handleStatusChange(task, 'completed')
                                            }]),
                                            {
                                                key: 'delete',
                                                // Quiet by default — a row of
                                                // saturated red buttons down the
                                                // page outshouted "Mark done".
                                                label: 'Delete',
                                                variant: 'danger-quiet',
                                                onClick: () => setPendingDelete(task)
                                            }
                                        ]}
                                    />
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>

            {pendingDelete && (
                <ConfirmDialog
                    title="Delete this task?"
                    description={`"${pendingDelete.title}" will be removed. This can’t be undone.`}
                    busy={deleting}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setPendingDelete(null)}
                />
            )}
        </div>
    );
};

export default Tasks;
