import React, { useCallback, useEffect, useMemo, useState } from 'react';
import taskService from '../services/taskService';
import routineService from '../services/routineService';
import './WeekView.css';

const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toHm = (timeValue) => {
    if (!timeValue || typeof timeValue !== 'string') return '';
    return timeValue.slice(0, 5);
};

const titleCase = (value) => (
    value
        ? value
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        : ''
);

const WeekView = () => {
    const [weekTasks, setWeekTasks] = useState([]);
    const [routines, setRoutines] = useState([]);
    const [weekRange, setWeekRange] = useState({ start: '', end: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadWeekData = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const [tasksResponse, routinesResponse] = await Promise.all([
                taskService.getWeekTasks(),
                routineService.getAllRoutines()
            ]);

            const taskPayload = tasksResponse?.data?.data || tasksResponse?.data || tasksResponse;
            const taskList = taskPayload?.tasks || taskPayload?.data?.tasks || [];
            setWeekTasks(taskList);
            setWeekRange({
                start: taskPayload?.start_date || taskPayload?.data?.start_date || '',
                end: taskPayload?.end_date || taskPayload?.data?.end_date || ''
            });

            const routinePayload = routinesResponse?.data?.data || routinesResponse?.data || routinesResponse;
            setRoutines(routinePayload?.routines || routinePayload?.data?.routines || []);
        } catch (loadError) {
            setError(loadError?.message || 'Failed to load weekly data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadWeekData();
    }, [loadWeekData]);

    const tasksByCategory = useMemo(() => {
        const grouped = new Map();
        weekTasks.forEach((task) => {
            const key = task.category?.trim() || 'Uncategorized';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(task);
        });

        return Array.from(grouped.entries())
            .map(([category, items]) => ({
                category,
                items: items.sort((a, b) => {
                    const dateCompare = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
                    if (dateCompare !== 0) return dateCompare;
                    return (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
                })
            }))
            .sort((a, b) => a.category.localeCompare(b.category));
    }, [weekTasks]);

    const routinesByType = useMemo(() => {
        const grouped = new Map();
        routines.forEach((routine) => {
            const key = routine.routine_type || 'custom';
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key).push(routine);
        });

        return Array.from(grouped.entries())
            .map(([type, items]) => ({
                type,
                items: items.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            }))
            .sort((a, b) => a.type.localeCompare(b.type));
    }, [routines]);

    const weeklyStats = useMemo(() => {
        const total = weekTasks.length;
        const completed = weekTasks.filter((task) => task.status === 'completed').length;
        const inProgress = weekTasks.filter((task) => task.status === 'in_progress').length;
        const pending = weekTasks.filter((task) => task.status === 'pending').length;
        return { total, completed, inProgress, pending };
    }, [weekTasks]);

    const dailyCounts = useMemo(() => {
        const days = [];
        for (let i = 6; i >= 0; i -= 1) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const ymd = toYmd(date);
            const count = weekTasks.filter((task) => task.scheduled_date === ymd).length;
            days.push({
                date: ymd,
                label: date.toLocaleDateString(undefined, { weekday: 'short' }),
                count
            });
        }
        return days;
    }, [weekTasks]);

    if (loading) {
        return (
            <div className="week-container">
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="week-container">
            <div className="week-header">
                <div>
                    <h1>Week Dashboard</h1>
                    <p className="muted">All tasks and routines from the past week, neatly grouped by category.</p>
                </div>
                <div className="week-range card">
                    <span className="profile-label">Week Range</span>
                    <p>{weekRange.start || '—'} → {weekRange.end || '—'}</p>
                </div>
            </div>

            {error && <p className="week-error">{error}</p>}

            <section className="week-summary card">
                <div className="week-summary-grid">
                    <div>
                        <span className="profile-label">Total Tasks</span>
                        <p>{weeklyStats.total}</p>
                    </div>
                    <div>
                        <span className="profile-label">Completed</span>
                        <p>{weeklyStats.completed}</p>
                    </div>
                    <div>
                        <span className="profile-label">In Progress</span>
                        <p>{weeklyStats.inProgress}</p>
                    </div>
                    <div>
                        <span className="profile-label">Pending</span>
                        <p>{weeklyStats.pending}</p>
                    </div>
                </div>

                <div className="week-strip">
                    {dailyCounts.map((day) => (
                        <div key={day.date} className="week-strip-item">
                            <span>{day.label}</span>
                            <strong>{day.count}</strong>
                        </div>
                    ))}
                </div>
            </section>

            <div className="week-grid">
                <section className="week-panel card">
                    <div className="week-panel-header">
                        <h2>Tasks by Category</h2>
                        <span className="muted">{weekTasks.length} tasks</span>
                    </div>

                    {tasksByCategory.length === 0 ? (
                        <p className="muted">No tasks scheduled for the past week.</p>
                    ) : (
                        <div className="week-category-grid">
                            {tasksByCategory.map((group) => (
                                <div key={group.category} className="week-category-card">
                                    <div className="week-category-header">
                                        <h3>{group.category}</h3>
                                        <span className="muted">{group.items.length}</span>
                                    </div>
                                    <div className="week-category-list">
                                        {group.items.map((task) => (
                                            <div key={task.id} className="week-task-item">
                                                <div>
                                                    <p className="week-task-title">{task.title}</p>
                                                    <p className="muted">{task.scheduled_date || 'Unscheduled'} {toHm(task.scheduled_time) && `• ${toHm(task.scheduled_time)}`}</p>
                                                </div>
                                                <div className="week-task-meta">
                                                    <span className={`status-badge status-${task.status}`}>{titleCase(task.status?.replace('_', ' ') || '')}</span>
                                                    <span className={`task-priority priority-${task.priority || 'medium'}`}>{task.priority || 'medium'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="week-panel card">
                    <div className="week-panel-header">
                        <h2>Routines by Type</h2>
                        <span className="muted">{routines.length} routines</span>
                    </div>

                    {routinesByType.length === 0 ? (
                        <p className="muted">No routines available yet.</p>
                    ) : (
                        <div className="week-category-grid">
                            {routinesByType.map((group) => (
                                <div key={group.type} className="week-category-card">
                                    <div className="week-category-header">
                                        <h3>{titleCase(group.type)}</h3>
                                        <span className="muted">{group.items.length}</span>
                                    </div>
                                    <div className="week-category-list">
                                        {group.items.map((routine) => (
                                            <div key={routine.id} className="week-task-item">
                                                <div>
                                                    <p className="week-task-title">{routine.name}</p>
                                                    <p className="muted">{routine.description || 'No description yet'}</p>
                                                </div>
                                                <div className="week-task-meta">
                                                    <span className={`status-badge ${routine.is_active ? 'status-active' : 'status-paused'}`}>
                                                        {routine.is_active ? 'Active' : 'Paused'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default WeekView;
