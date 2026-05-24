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
        remaining: 0,
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
        const remaining = Math.max(total - completed, 0);
        setStats({
            total,
            completed,
            remaining,
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

    const handleStatusUpdate = async (taskId, status) => {
        try {
            await updateScheduleTaskStatus(taskId, status);
        } catch (updateError) {
            console.error('Failed to update schedule task status:', updateError);
        }
    };

    const groupedTasks = useMemo(() => {
        const currentMinutes = (now.getHours() * 60) + now.getMinutes();

        const tasksWithTimes = scheduleTasks.map((task) => ({
            ...task,
            startMinutes: getTaskStartMinutes(task),
            endMinutes: getTaskEndMinutes(task)
        }));

        const currentCandidates = tasksWithTimes.filter((task) => (
            Number.isFinite(task.startMinutes)
            && Number.isFinite(task.endMinutes)
            && task.startMinutes <= currentMinutes
            && currentMinutes < task.endMinutes
        ));

        const sortByTime = (a, b) => (
            (a.startMinutes ?? Number.POSITIVE_INFINITY) - (b.startMinutes ?? Number.POSITIVE_INFINITY)
        );

        const currentTask = currentCandidates.sort(sortByTime)[0] || null;

        const pastTasks = tasksWithTimes.filter((task) => (
            Number.isFinite(task.endMinutes) && task.endMinutes <= currentMinutes
        )).sort(sortByTime);

        const upcomingTasks = tasksWithTimes.filter((task) => (
            Number.isFinite(task.startMinutes) && task.startMinutes > currentMinutes
        )).sort(sortByTime);

        return {
            currentTask,
            past: pastTasks,
            upcoming: upcomingTasks,
            currentMinutes
        };
    }, [scheduleTasks, now]);

    const canUpdatePastStatus = (task, currentMinutes) => {
        const endMinutes = getTaskEndMinutes(task);
        return Number.isFinite(endMinutes) && currentMinutes >= endMinutes;
    };

    const getProgressPercent = (task, currentMinutes) => {
        const startMinutes = getTaskStartMinutes(task);
        const endMinutes = getTaskEndMinutes(task);
        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
            return 0;
        }
        if (currentMinutes >= endMinutes) return 100;
        if (currentMinutes <= startMinutes) return 0;
        return Math.min(100, Math.max(0, ((currentMinutes - startMinutes) / (endMinutes - startMinutes)) * 100));
    };

    const analytics = useMemo(() => {
        const completedCount = groupedTasks.past.filter((task) => task.status === 'completed').length;
        const incompleteCount = groupedTasks.past.filter((task) => task.status !== 'completed').length;
        const upcomingCount = groupedTasks.upcoming.length;
        const maxValue = Math.max(completedCount, incompleteCount, upcomingCount, 1);

        return {
            completedCount,
            incompleteCount,
            upcomingCount,
            maxValue
        };
    }, [groupedTasks]);

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
                        <h1>Today's Dashboard</h1>
                        <p className="today-subtitle">Stay on track with a real-time view of today’s tasks.</p>
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
                            <div
                                className="progress-fill"
                                style={{ width: `${stats.percentage}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="today-chart">
                        <div className="chart-header">
                            <div>
                                <h3>Today’s Task Analytics</h3>
                                <p>Completed vs incomplete vs upcoming</p>
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
                                    <h2>Current Progress Task</h2>
                                    <span>Active right now</span>
                                </div>
                                <span className="task-section-count">{groupedTasks.currentTask ? 1 : 0}</span>
                            </div>
                            <div className="task-section-body">
                                {!groupedTasks.currentTask ? (
                                    <div className="task-section-empty">No active task for the current time slot.</div>
                                ) : (
                                    <div
                                        className={`task-item task-item--current ${groupedTasks.currentTask.status === 'completed' ? 'completed' : ''}`}
                                    >
                                        <div className="task-content">
                                            <div className="task-title-row">
                                                <h3 className="task-title">{groupedTasks.currentTask.title}</h3>
                                                <span className="task-status-badge status-current">Now</span>
                                            </div>
                                            {groupedTasks.currentTask.description && (
                                                <p className="task-description">{groupedTasks.currentTask.description}</p>
                                            )}
                                            <div className="task-meta">
                                                <span className="task-time">⏰ {formatDisplayTime(groupedTasks.currentTask.slot_start_time)} - {formatDisplayTime(groupedTasks.currentTask.slot_end_time)}</span>
                                                {groupedTasks.currentTask.priority && (
                                                    <span className={`task-priority priority-${groupedTasks.currentTask.priority}`}>
                                                        {groupedTasks.currentTask.priority}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="task-progress">
                                                <div
                                                    className="task-progress-fill"
                                                    style={{ width: `${getProgressPercent(groupedTasks.currentTask, groupedTasks.currentMinutes)}%` }}
                                                ></div>
                                            </div>
                                            <div className="task-hint">
                                                Status updates unlock after the task ends.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="task-section">
                            <div className="task-section-header">
                                <div>
                                    <h2>Upcoming Tasks</h2>
                                    <span>Next on your schedule</span>
                                </div>
                                <span className="task-section-count">{groupedTasks.upcoming.length}</span>
                            </div>
                            <div className="task-section-body">
                                {groupedTasks.upcoming.length === 0 ? (
                                    <div className="task-section-empty">No upcoming tasks scheduled.</div>
                                ) : (
                                    groupedTasks.upcoming.map((task) => (
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
                                                <div className="task-progress">
                                                    <div className="task-progress-fill" style={{ width: '0%' }}></div>
                                                </div>
                                                <div className="task-actions">
                                                    <Button
                                                        variant="secondary"
                                                        className="task-action-btn"
                                                        onClick={() => navigate('/dashboard')}
                                                    >
                                                        Edit Details
                                                    </Button>
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
                                    <h2>Past Tasks</h2>
                                    <span>Earlier today</span>
                                </div>
                                <span className="task-section-count">{groupedTasks.past.length}</span>
                            </div>
                            <div className="task-section-body">
                                {groupedTasks.past.length === 0 ? (
                                    <div className="task-section-empty">No past tasks. You’re ahead of schedule!</div>
                                ) : (
                                    groupedTasks.past.map((task) => (
                                        <div
                                            key={task.id}
                                            className={`task-item task-item--past ${task.status === 'completed' ? 'completed' : ''}`}
                                        >
                                            <div className="task-content">
                                                <div className="task-title-row">
                                                    <h3 className="task-title">{task.title}</h3>
                                                    <span className={`task-status-badge ${task.status === 'completed' ? 'status-completed' : 'status-incomplete'}`}>
                                                        {task.status === 'completed' ? 'Complete' : 'Incomplete'}
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
                                                <div className="task-progress">
                                                    <div className="task-progress-fill" style={{ width: '100%' }}></div>
                                                </div>
                                                <div className="task-actions">
                                                    <Button
                                                        variant="primary"
                                                        className="task-action-btn"
                                                        onClick={() => handleStatusUpdate(task.id, 'completed')}
                                                        disabled={!canUpdatePastStatus(task, groupedTasks.currentMinutes)}
                                                    >
                                                        Complete
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        className="task-action-btn"
                                                        onClick={() => handleStatusUpdate(task.id, 'pending')}
                                                        disabled={!canUpdatePastStatus(task, groupedTasks.currentMinutes)}
                                                    >
                                                        Incomplete
                                                    </Button>
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
