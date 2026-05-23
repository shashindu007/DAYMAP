import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchedule } from '../context/ScheduleContext';
import Button from '../components/common/Button';
import './TodayView.css';

const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const TodayView = () => {
    const { scheduleByDate, loading, error, fetchSchedule, updateScheduleTaskStatus } = useSchedule();
    const navigate = useNavigate();

    const [now, setNow] = useState(new Date());
    const todayYmd = useMemo(() => toYmd(now), [now]);
    const scheduleTasks = scheduleByDate[todayYmd]?.tasks || [];

    const [stats, setStats] = useState({
        total: 0,
        completed: 0,
        percentage: 0
    });

    useEffect(() => {
        fetchSchedule(todayYmd).catch(() => null);
    }, [fetchSchedule, todayYmd]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const completed = scheduleTasks.filter((t) => t.status === 'completed').length;
        const total = scheduleTasks.length;
        setStats({
            total,
            completed,
            percentage: total > 0 ? (completed / total) * 100 : 0
        });
    }, [scheduleTasks]);

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

    const getTaskStartMinutes = (task) => timeToMinutes(task?.slot_start_time);

    const getTaskEndMinutes = (task) => timeToMinutes(task?.slot_end_time);

    const canStartTask = (task, currentMinutes) => {
        if (task.status !== 'pending') return false;
        const startMinutes = getTaskStartMinutes(task);
        if (!Number.isFinite(startMinutes)) return true;
        return currentMinutes >= startMinutes;
    };

    const canCompleteTask = (task, currentMinutes) => {
        if (task.status === 'completed') return false;
        const endMinutes = getTaskEndMinutes(task);
        if (Number.isFinite(endMinutes)) return currentMinutes >= endMinutes;
        const startMinutes = getTaskStartMinutes(task);
        if (Number.isFinite(startMinutes)) return currentMinutes >= startMinutes;
        return true;
    };

    const handleStatusUpdate = async (taskId, status) => {
        try {
            await updateScheduleTaskStatus(taskId, status);
        } catch (updateError) {
            console.error('Failed to update schedule task status:', updateError);
        }
    };

    const groupedTasks = useMemo(() => {
        const currentMinutes = (now.getHours() * 60) + now.getMinutes();
        const completedTasks = scheduleTasks.filter((task) => ['completed', 'cancelled'].includes(task.status));
        const inProgressTasks = scheduleTasks.filter((task) => task.status === 'in_progress');
        const pendingTasks = scheduleTasks.filter((task) => task.status === 'pending');

        const nowTasks = pendingTasks.filter((task) => {
            const start = getTaskStartMinutes(task);
            const end = getTaskEndMinutes(task);
            return Number.isFinite(start)
                && Number.isFinite(end)
                && start <= currentMinutes
                && currentMinutes < end;
        });

        const pastTasks = pendingTasks.filter((task) => {
            const end = getTaskEndMinutes(task);
            return Number.isFinite(end) && end < currentMinutes;
        });

        const upcomingTasks = pendingTasks.filter((task) => {
            const start = getTaskStartMinutes(task);
            return Number.isFinite(start) && start >= currentMinutes;
        });

        const sortByTime = (a, b) => {
            const aMinutes = timeToMinutes(a.slot_start_time);
            const bMinutes = timeToMinutes(b.slot_start_time);
            return (aMinutes ?? Number.POSITIVE_INFINITY) - (bMinutes ?? Number.POSITIVE_INFINITY);
        };

        return {
            now: nowTasks.sort(sortByTime),
            past: pastTasks.sort(sortByTime),
            upcoming: upcomingTasks.sort(sortByTime),
            inProgress: inProgressTasks.sort(sortByTime),
            completed: completedTasks.sort(sortByTime),
            currentMinutes
        };
    }, [scheduleTasks, now]);

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
                        <h1>Today's Schedule</h1>
                        <p className="today-subtitle">Track every 30-minute slot and keep tasks moving.</p>
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
                        <Button variant="secondary" onClick={() => navigate('/dashboard')}>
                            Edit Schedule
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

            {error && <p className="today-error">{error}</p>}

            <div className="tasks-list">
                {scheduleTasks.length === 0 ? (
                    <div className="empty-state">
                        <p>No scheduled slots for today yet.</p>
                        <Button variant="primary" onClick={() => navigate('/dashboard')}>Schedule Today</Button>
                    </div>
                ) : (
                    <>
                        <div className="task-section">
                            <div className="task-section-header">
                                <div>
                                    <h2>Now</h2>
                                    <span>Currently active slots</span>
                                </div>
                                <span className="task-section-count">{groupedTasks.now.length}</span>
                            </div>
                            <div className="task-section-body">
                                {groupedTasks.now.length === 0 ? (
                                    <div className="task-section-empty">No tasks in the current slot.</div>
                                ) : (
                                    groupedTasks.now.map((task) => (
                                        <div
                                            key={task.id}
                                            className={`task-item task-item--upcoming ${task.status === 'completed' ? 'completed' : ''}`}
                                        >
                                            <div className="task-content">
                                                <div className="task-title-row">
                                                    <h3 className="task-title">{task.title}</h3>
                                                    <span className="task-status-badge status-upcoming">Now</span>
                                                </div>
                                                {task.description && (
                                                    <p className="task-description">{task.description}</p>
                                                )}
                                                <div className="task-meta">
                                                    <span className="task-time">⏰ {formatDisplayTime(task.slot_start_time)} - {formatDisplayTime(task.slot_end_time)}</span>
                                                    {task.priority && (
                                                        <span className={`task-priority priority-${task.priority}`}>
                                                            {task.priority}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="task-actions">
                                                    {canStartTask(task, groupedTasks.currentMinutes) && (
                                                        <Button
                                                            variant="secondary"
                                                            className="task-action-btn"
                                                            onClick={() => handleStatusUpdate(task.id, 'in_progress')}
                                                        >
                                                            Start
                                                        </Button>
                                                    )}
                                                    {canCompleteTask(task, groupedTasks.currentMinutes) && (
                                                        <Button
                                                            variant="primary"
                                                            className="task-action-btn"
                                                            onClick={() => handleStatusUpdate(task.id, 'completed')}
                                                        >
                                                            Complete
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
                                    <h2>In Progress</h2>
                                    <span>Tasks you marked as active</span>
                                </div>
                                <span className="task-section-count">{groupedTasks.inProgress.length}</span>
                            </div>
                            <div className="task-section-body">
                                {groupedTasks.inProgress.length === 0 ? (
                                    <div className="task-section-empty">Nothing in progress yet.</div>
                                ) : (
                                    groupedTasks.inProgress.map((task) => (
                                        <div
                                            key={task.id}
                                            className={`task-item task-item--upcoming ${task.status === 'completed' ? 'completed' : ''}`}
                                        >
                                            <div className="task-content">
                                                <div className="task-title-row">
                                                    <h3 className="task-title">{task.title}</h3>
                                                    <span className="task-status-badge status-upcoming">In Progress</span>
                                                </div>
                                                {task.description && (
                                                    <p className="task-description">{task.description}</p>
                                                )}
                                                <div className="task-meta">
                                                    <span className="task-time">⏰ {formatDisplayTime(task.slot_start_time)} - {formatDisplayTime(task.slot_end_time)}</span>
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
                                                            onClick={() => handleStatusUpdate(task.id, 'completed')}
                                                        >
                                                            Complete
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
                                                    <span className="task-time">⏰ {formatDisplayTime(task.slot_start_time)} - {formatDisplayTime(task.slot_end_time)}</span>
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
                                                            onClick={() => updateScheduleTaskStatus(task.id, 'completed')}
                                                        >
                                                            Complete
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
                                                    <span className="task-time">⏰ {formatDisplayTime(task.slot_start_time)} - {formatDisplayTime(task.slot_end_time)}</span>
                                                    {task.priority && (
                                                        <span className={`task-priority priority-${task.priority}`}>
                                                            {task.priority}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="task-actions">
                                                    {canStartTask(task, groupedTasks.currentMinutes) && (
                                                        <Button
                                                            variant="secondary"
                                                            className="task-action-btn"
                                                            onClick={() => handleStatusUpdate(task.id, 'in_progress')}
                                                        >
                                                            Start
                                                        </Button>
                                                    )}
                                                    {canCompleteTask(task, groupedTasks.currentMinutes) && (
                                                        <Button
                                                            variant="primary"
                                                            className="task-action-btn"
                                                            onClick={() => handleStatusUpdate(task.id, 'completed')}
                                                        >
                                                            Complete
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
                                                    <span className="task-status-badge status-completed">
                                                        {task.status === 'cancelled' ? 'Cancelled' : 'Completed'}
                                                    </span>
                                                </div>
                                                {task.description && (
                                                    <p className="task-description">{task.description}</p>
                                                )}
                                                <div className="task-meta">
                                                    <span className="task-time">⏰ {formatDisplayTime(task.slot_start_time)} - {formatDisplayTime(task.slot_end_time)}</span>
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
        </div>
    );
};

export default TodayView;
