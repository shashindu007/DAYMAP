import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../context/TaskContext';
import Button from '../components/common/Button';
import './TodayView.css';

const TodayView = () => {
    const navigate = useNavigate();
    const { tasks, loading, fetchTodayTasks, completeTask, createTask } = useTasks();
    const today = new Date().toISOString().split('T')[0];

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
                    <h1>Today's Tasks</h1>
                    <div className="today-actions">
                        <Button variant="secondary" onClick={() => navigate('/dashboard')}>
                            Dashboard
                        </Button>
                        <Button variant="secondary" onClick={() => navigate('/tasks')}>
                            All Tasks
                        </Button>
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
                    tasks.map(task => (
                        <div 
                            key={task.id} 
                            className={`task-item ${task.status === 'completed' ? 'completed' : ''}`}
                        >
                            <div className="task-checkbox">
                                <input
                                    type="checkbox"
                                    checked={task.status === 'completed'}
                                    onChange={() => handleComplete(task.id)}
                                />
                            </div>
                            <div className="task-content">
                                <h3 className="task-title">{task.title}</h3>
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
