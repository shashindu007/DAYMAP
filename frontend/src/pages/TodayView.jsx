import React, { useEffect, useMemo, useState } from 'react';
import { useTasks } from '../context/TaskContext';
import Button from '../components/common/Button';
import './TodayView.css';

const TodayView = () => {
    const { tasks, loading, fetchTodayTasks, completeTask, createTask, deleteTask } = useTasks();
    const today = new Date().toISOString().split('T')[0];

    const [now, setNow] = useState(new Date());

    const [showAddModal, setShowAddModal] = useState(false);
    const [savingTask, setSavingTask] = useState(false);
    const [formError, setFormError] = useState('');
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'medium',
        scheduled_date: today,
        scheduled_time: '',
        duration_minutes: ''
    });

    const [stats, setStats] = useState({
        total: 0,
        completed: 0,
        percentage: 0
    });

    useEffect(() => {
        const loadTodayTasks = async () => {
            try {
                await fetchTodayTasks();
            } catch (error) {
                console.error('Error loading tasks:', error);
            }
        };

        loadTodayTasks();
    }, [fetchTodayTasks]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const completed = tasks.filter(t => t.status === 'completed').length;
        const total = tasks.length;
        setStats({
            total,
            completed,
            percentage: total > 0 ? (completed / total) * 100 : 0
        });
    }, [tasks]);

    const handleComplete = async (taskId) => {
        try {
            await completeTask(taskId);
        } catch (error) {
            console.error('Error completing task:', error);
        }
    };

    const handleDelete = async (taskId) => {
        try {
            await deleteTask(taskId);
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const handleOpenAddTask = () => {
        setFormError('');
        setShowAddModal(true);
    };

    const handleCloseAddTask = () => {
        setShowAddModal(false);
        setFormError('');
        setNewTask({
            title: '',
            description: '',
            priority: 'medium',
            scheduled_date: today,
            scheduled_time: '',
            duration_minutes: ''
        });
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setNewTask((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const formatScheduledTime = (timeValue) => {
        if (!timeValue) return undefined;
        if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(timeValue)) {
            return timeValue;
        }
        return `${timeValue}:00`;
    };

    const formatDisplayTime = (timeValue) => {
        if (!timeValue) return '';
        return timeValue.length >= 5 ? timeValue.slice(0, 5) : timeValue;
    };

    const timeToMinutes = (timeValue) => {
        if (!timeValue) return null;
        const [hours, minutes] = timeValue.split(':').map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
        return (hours * 60) + minutes;
    };

    const getTaskStartMinutes = (task) => timeToMinutes(task?.scheduled_time);

    const getTaskEndMinutes = (task) => {
        const startMinutes = getTaskStartMinutes(task);
        if (!Number.isFinite(startMinutes)) return null;
        const duration = Number(task?.duration_minutes);
        if (!Number.isFinite(duration) || duration <= 0) return null;
        return startMinutes + duration;
    };

    const canDeleteTask = (task, currentMinutes) => {
        if (task.status === 'completed') return false;
        const startMinutes = getTaskStartMinutes(task);
        if (!Number.isFinite(startMinutes)) return true;
        return currentMinutes < startMinutes;
    };

    const canCompleteTask = (task, currentMinutes) => {
        if (task.status === 'completed') return false;
        const endMinutes = getTaskEndMinutes(task);
        if (Number.isFinite(endMinutes)) return currentMinutes >= endMinutes;
        const startMinutes = getTaskStartMinutes(task);
        if (Number.isFinite(startMinutes)) return currentMinutes >= startMinutes;
        return true;
    };

    const groupedTasks = useMemo(() => {
        const currentMinutes = (now.getHours() * 60) + now.getMinutes();

        const completedTasks = tasks.filter(task => task.status === 'completed');
        const pendingTasks = tasks.filter(task => task.status !== 'completed');
        const timedPendingTasks = pendingTasks.filter(task => task.scheduled_time);
        const anytimeTasks = pendingTasks.filter(task => !task.scheduled_time);

        const pastTasks = timedPendingTasks.filter(task => {
            const taskMinutes = timeToMinutes(task.scheduled_time);
            return Number.isFinite(taskMinutes) && taskMinutes < currentMinutes;
        });

        const upcomingTasks = timedPendingTasks.filter(task => {
            const taskMinutes = timeToMinutes(task.scheduled_time);
            return Number.isFinite(taskMinutes) && taskMinutes >= currentMinutes;
        });

        const sortByTime = (a, b) => {
            const aMinutes = timeToMinutes(a.scheduled_time);
            const bMinutes = timeToMinutes(b.scheduled_time);
            return (aMinutes ?? Number.POSITIVE_INFINITY) - (bMinutes ?? Number.POSITIVE_INFINITY);
        };

        return {
            past: pastTasks.sort(sortByTime),
            upcoming: upcomingTasks.sort(sortByTime),
            anytime: anytimeTasks.sort((a, b) => a.title.localeCompare(b.title)),
            completed: completedTasks.sort(sortByTime),
            currentMinutes
        };
    }, [tasks, now]);

    const handleCreateTask = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!newTask.title.trim()) {
            setFormError('Task title is required.');
            return;
        }

        try {
            setSavingTask(true);

            const normalizedDuration = newTask.duration_minutes
                ? parseInt(newTask.duration_minutes, 10)
                : undefined;

            const payload = {
                title: newTask.title.trim(),
                description: newTask.description.trim() || null,
                priority: newTask.priority,
                scheduled_date: newTask.scheduled_date || today,
                scheduled_time: formatScheduledTime(newTask.scheduled_time),
                duration_minutes: Number.isFinite(normalizedDuration) ? normalizedDuration : undefined
            };

            await createTask(payload);
            try {
                await fetchTodayTasks();
            } catch (refreshError) {
                // Non-blocking: task was created successfully, refresh can retry later.
                console.warn('Task created but refresh failed:', refreshError);
            }
            handleCloseAddTask();
        } catch (error) {
            const validationMessage = error?.errors?.[0]?.message;
            setFormError(validationMessage || error?.message || 'Failed to create task. Please try again.');
        } finally {
            setSavingTask(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="today-container">
            <div className="today-header">
                <div className="today-header-top">
                    <div>
                        <h1>Today's Tasks</h1>
                        <p className="today-subtitle">Stay aligned with the time and keep tasks moving.</p>
                    </div>
                    <div className="today-live-clock">
                        <p className="today-clock-date">
                            {now.toLocaleDateString(undefined, {
                                weekday: 'long',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </p>
                        <p className="today-clock-time">
                            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                    </div>
                    <div className="today-actions">
                        <Button variant="primary" onClick={handleOpenAddTask}>
                            Add Task
                        </Button>
                    </div>
                </div>
                <div className="stats">
                    <div className="stat-item">
                        <span className="stat-value">{stats.completed}</span>
                        <span className="stat-label">/ {stats.total} Completed</span>
                    </div>
                    <div className="progress-bar">
                        <div 
                            className="progress-fill" 
                            style={{ width: `${stats.percentage}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            <div className="tasks-list">
                {tasks.length === 0 ? (
                    <div className="empty-state">
                        <p>No tasks for today. Create your first task!</p>
                        <Button variant="primary" onClick={handleOpenAddTask}>Add Task</Button>
                    </div>
                ) : (
                    <>
                        <div className="task-section">
                            <div className="task-section-header">
                                <div>
                                    <h2>Past</h2>
                                    <span>Earlier today</span>
                                </div>
                                <span className="task-section-count">{groupedTasks.past.length}</span>
                            </div>
                            <div className="task-section-body">
                                {groupedTasks.past.length === 0 ? (
                                    <div className="task-section-empty">No past tasks. You're on track!</div>
                                ) : (
                                    groupedTasks.past.map(task => (
                                        <div
                                            key={task.id}
                                            className={`task-item task-item--past ${task.status === 'completed' ? 'completed' : ''}`}
                                        >
                                            <div className="task-content">
                                                <div className="task-title-row">
                                                    <h3 className="task-title">{task.title}</h3>
                                                    <span className="task-status-badge status-past">Past</span>
                                                </div>
                                                {task.description && (
                                                    <p className="task-description">{task.description}</p>
                                                )}
                                                <div className="task-meta">
                                                    {task.scheduled_time && (
                                                        <span className="task-time">⏰ {formatDisplayTime(task.scheduled_time)}</span>
                                                    )}
                                                    {task.duration_minutes && (
                                                        <span className="task-duration">⏱ {task.duration_minutes} min</span>
                                                    )}
                                                    {task.priority && (
                                                        <span className={`task-priority priority-${task.priority}`}>
                                                            {task.priority}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="task-actions">
                                                    {canCompleteTask(task, groupedTasks.currentMinutes) && (
                                                        <Button
                                                            variant="primary"
                                                            className="task-action-btn"
                                                            onClick={() => handleComplete(task.id)}
                                                        >
                                                            Complete
                                                        </Button>
                                                    )}
                                                    {canDeleteTask(task, groupedTasks.currentMinutes) && (
                                                        <Button
                                                            variant="secondary"
                                                            className="task-action-btn"
                                                            onClick={() => handleDelete(task.id)}
                                                        >
                                                            Remove
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="task-section">
                            <div className="task-section-header">
                                <div>
                                    <h2>Upcoming</h2>
                                    <span>Next on your schedule</span>
                                </div>
                                <span className="task-section-count">{groupedTasks.upcoming.length}</span>
                            </div>
                            <div className="task-section-body">
                                {groupedTasks.upcoming.length === 0 ? (
                                    <div className="task-section-empty">No upcoming tasks scheduled.</div>
                                ) : (
                                    groupedTasks.upcoming.map(task => (
                                        <div
                                            key={task.id}
                                            className={`task-item task-item--upcoming ${task.status === 'completed' ? 'completed' : ''}`}
                                        >
                                            <div className="task-content">
                                                <div className="task-title-row">
                                                    <h3 className="task-title">{task.title}</h3>
                                                    <span className="task-status-badge status-upcoming">Upcoming</span>
                                                </div>
                                                {task.description && (
                                                    <p className="task-description">{task.description}</p>
                                                )}
                                                <div className="task-meta">
                                                    {task.scheduled_time && (
                                                        <span className="task-time">⏰ {formatDisplayTime(task.scheduled_time)}</span>
                                                    )}
                                                    {task.duration_minutes && (
                                                        <span className="task-duration">⏱ {task.duration_minutes} min</span>
                                                    )}
                                                    {task.priority && (
                                                        <span className={`task-priority priority-${task.priority}`}>
                                                            {task.priority}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="task-actions">
                                                    {canCompleteTask(task, groupedTasks.currentMinutes) && (
                                                        <Button
                                                            variant="primary"
                                                            className="task-action-btn"
                                                            onClick={() => handleComplete(task.id)}
                                                        >
                                                            Complete
                                                        </Button>
                                                    )}
                                                    {canDeleteTask(task, groupedTasks.currentMinutes) && (
                                                        <Button
                                                            variant="secondary"
                                                            className="task-action-btn"
                                                            onClick={() => handleDelete(task.id)}
                                                        >
                                                            Remove
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="task-section">
                            <div className="task-section-header">
                                <div>
                                    <h2>Anytime</h2>
                                    <span>Flexible tasks without a fixed time</span>
                                </div>
                                <span className="task-section-count">{groupedTasks.anytime.length}</span>
                            </div>
                            <div className="task-section-body">
                                {groupedTasks.anytime.length === 0 ? (
                                    <div className="task-section-empty">Nothing flexible right now.</div>
                                ) : (
                                    groupedTasks.anytime.map(task => (
                                        <div
                                            key={task.id}
                                            className={`task-item task-item--anytime ${task.status === 'completed' ? 'completed' : ''}`}
                                        >
                                            <div className="task-content">
                                                <div className="task-title-row">
                                                    <h3 className="task-title">{task.title}</h3>
                                                    <span className="task-status-badge status-anytime">Anytime</span>
                                                </div>
                                                {task.description && (
                                                    <p className="task-description">{task.description}</p>
                                                )}
                                                <div className="task-meta">
                                                    <span className="task-time">🧭 Anytime</span>
                                                    {task.duration_minutes && (
                                                        <span className="task-duration">⏱ {task.duration_minutes} min</span>
                                                    )}
                                                    {task.priority && (
                                                        <span className={`task-priority priority-${task.priority}`}>
                                                            {task.priority}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="task-actions">
                                                    {canCompleteTask(task, groupedTasks.currentMinutes) && (
                                                        <Button
                                                            variant="primary"
                                                            className="task-action-btn"
                                                            onClick={() => handleComplete(task.id)}
                                                        >
                                                            Complete
                                                        </Button>
                                                    )}
                                                    {canDeleteTask(task, groupedTasks.currentMinutes) && (
                                                        <Button
                                                            variant="secondary"
                                                            className="task-action-btn"
                                                            onClick={() => handleDelete(task.id)}
                                                        >
                                                            Remove
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="task-section">
                            <div className="task-section-header">
                                <div>
                                    <h2>Completed</h2>
                                    <span>Nice work finishing these</span>
                                </div>
                                <span className="task-section-count">{groupedTasks.completed.length}</span>
                            </div>
                            <div className="task-section-body">
                                {groupedTasks.completed.length === 0 ? (
                                    <div className="task-section-empty">No completed tasks yet.</div>
                                ) : (
                                    groupedTasks.completed.map(task => (
                                        <div
                                            key={task.id}
                                            className="task-item task-item--completed completed"
                                        >
                                            <div className="task-content">
                                                <div className="task-title-row">
                                                    <h3 className="task-title">{task.title}</h3>
                                                    <span className="task-status-badge status-completed">Completed</span>
                                                </div>
                                                {task.description && (
                                                    <p className="task-description">{task.description}</p>
                                                )}
                                                <div className="task-meta">
                                                    {task.scheduled_time && (
                                                        <span className="task-time">⏰ {formatDisplayTime(task.scheduled_time)}</span>
                                                    )}
                                                    {task.duration_minutes && (
                                                        <span className="task-duration">⏱ {task.duration_minutes} min</span>
                                                    )}
                                                    {task.priority && (
                                                        <span className={`task-priority priority-${task.priority}`}>
                                                            {task.priority}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {showAddModal && (
                <div className="task-modal-overlay" onClick={handleCloseAddTask}>
                    <div className="task-modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Add a task</h2>
                        <p className="task-modal-subtitle">Plan what matters and keep your day clear.</p>

                        <form onSubmit={handleCreateTask} className="task-form">
                            <label className="task-form-label" htmlFor="title">Title *</label>
                            <input
                                id="title"
                                name="title"
                                type="text"
                                value={newTask.title}
                                onChange={handleFormChange}
                                placeholder="e.g., Finish project proposal"
                                className="task-form-input"
                                maxLength={255}
                                required
                            />

                            <label className="task-form-label" htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={newTask.description}
                                onChange={handleFormChange}
                                placeholder="Optional notes..."
                                className="task-form-textarea"
                                rows={3}
                            />

                            <div className="task-form-grid">
                                <div>
                                    <label className="task-form-label" htmlFor="priority">Priority</label>
                                    <select
                                        id="priority"
                                        name="priority"
                                        value={newTask.priority}
                                        onChange={handleFormChange}
                                        className="task-form-input"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="task-form-label" htmlFor="duration_minutes">Duration (min)</label>
                                    <input
                                        id="duration_minutes"
                                        name="duration_minutes"
                                        type="number"
                                        min="1"
                                        value={newTask.duration_minutes}
                                        onChange={handleFormChange}
                                        className="task-form-input"
                                        placeholder="30"
                                    />
                                </div>
                            </div>

                            <div className="task-form-grid">
                                <div>
                                    <label className="task-form-label" htmlFor="scheduled_date">Date</label>
                                    <input
                                        id="scheduled_date"
                                        name="scheduled_date"
                                        type="date"
                                        value={newTask.scheduled_date}
                                        onChange={handleFormChange}
                                        className="task-form-input"
                                    />
                                </div>

                                <div>
                                    <label className="task-form-label" htmlFor="scheduled_time">Time</label>
                                    <input
                                        id="scheduled_time"
                                        name="scheduled_time"
                                        type="time"
                                        value={newTask.scheduled_time}
                                        onChange={handleFormChange}
                                        className="task-form-input"
                                    />
                                </div>
                            </div>

                            {formError && (
                                <div className="task-form-error" role="alert" aria-live="polite">
                                    {formError}
                                </div>
                            )}

                            <div className="task-modal-actions">
                                <Button variant="secondary" onClick={handleCloseAddTask} disabled={savingTask}>
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" loading={savingTask}>
                                    Save Task
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TodayView;
