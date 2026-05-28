import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../context/TaskContext';
import Button from '../components/common/Button';
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
    const navigate = useNavigate();
    const { tasks, loading, error, fetchTasks, updateTask, deleteTask } = useTasks();
    const [statusFilter, setStatusFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('all');

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

    const handleDelete = async (taskId) => {
        const shouldDelete = window.confirm('Delete this task? This action cannot be undone.');
        if (!shouldDelete) return;

        try {
            await deleteTask(taskId);
        } catch (deleteError) {
            console.error('Failed to delete task:', deleteError);
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

    const canMarkComplete = (task) => {
        if (task.status === 'completed') return false;
        const taskDateTime = getTaskDateTime(task);
        if (!taskDateTime) return true;
        const now = new Date();
        const diff = now - taskDateTime;
        if (diff < 0) return false;
        return diff <= HOURS_24_MS;
    };

    return (
        <div className="tasks-page">
            <div className="tasks-page-header">
                <h1>All Tasks</h1>
                <div className="tasks-header-actions">
                    <Button variant="primary" onClick={() => navigate('/today')}>
                        + New Task
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
                    <option value="all">Last 7 days</option>
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

            {loading && <p className="tasks-feedback">Loading tasks...</p>}
            {error && (
                <p className="tasks-feedback tasks-error" role="alert" aria-live="polite">
                    {error}
                </p>
            )}

            {!loading && filteredTasks.length === 0 && (
                <div className="tasks-empty">
                    <p>No tasks found in the last 7 days for the current filter.</p>
                    <Button variant="primary" onClick={() => navigate('/today')}>
                        Create a task
                    </Button>
                </div>
            )}

            {groupedTasks.map((group) => (
                <section key={group.date} className="tasks-day-group">
                    <div className="tasks-day-header">
                        <div>
                            <h2 className="tasks-day-title">{getRelativeLabel(group.date)}</h2>
                            <span className="tasks-day-subtitle">{formatDateLabel(group.date)}</span>
                        </div>
                        <span className="tasks-day-date">{group.date}</span>
                    </div>
                    <div className="tasks-list-grid">
                        {group.tasks.map((task) => {
                            const allowComplete = canMarkComplete(task);
                            return (
                                <article key={task.id} className="tasks-card">
                                    <div className="tasks-card-top">
                                        <h3>{task.title}</h3>
                                        <span className={`tasks-pill tasks-pill-${task.status}`}>{task.status.replace('_', ' ')}</span>
                                    </div>

                                    {task.description && <p className="tasks-card-desc">{task.description}</p>}

                                    <div className="tasks-meta-row">
                                        {task.scheduled_date && <span>📅 {task.scheduled_date}</span>}
                                        {task.scheduled_time && <span>⏰ {formatDisplayTime(task.scheduled_time)}</span>}
                                        {task.duration_minutes && <span>⏱ {task.duration_minutes} min</span>}
                                    </div>

                                    {!allowComplete && task.status !== 'completed' && (
                                        <span className="tasks-status-locked">Status locked after 24 hours</span>
                                    )}

                                    <div className="tasks-card-actions">
                                        {task.status !== 'completed' && (
                                            <Button
                                                variant="secondary"
                                                onClick={() => handleStatusChange(task, 'completed')}
                                                disabled={!allowComplete}
                                            >
                                                Mark done
                                            </Button>
                                        )}
                                        <Button variant="danger" onClick={() => handleDelete(task.id)}>
                                            Delete
                                        </Button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
};

export default Tasks;
