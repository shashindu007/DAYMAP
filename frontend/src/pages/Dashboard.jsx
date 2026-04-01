import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TaskContext';
import usageService from '../services/usageService';
import './Dashboard.css';

const TASK_TIME_STORAGE_KEY = 'daymap_task_time_v1';

const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatElapsed = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = safe % 60;
    return `${`${hours}`.padStart(2, '0')}:${`${minutes}`.padStart(2, '0')}:${`${secs}`.padStart(2, '0')}`;
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { tasks, loading, error, fetchTasks, createTask } = useTasks();
    const today = toYmd(new Date());

    const [now, setNow] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(today);
    const [calendarForm, setCalendarForm] = useState({
        title: '',
        scheduled_time: '',
        duration_minutes: '30',
        priority: 'medium'
    });
    const [calendarError, setCalendarError] = useState('');
    const [savingCalendarTask, setSavingCalendarTask] = useState(false);

    const [activeTimerTaskId, setActiveTimerTaskId] = useState(null);
    const [timerStartedAt, setTimerStartedAt] = useState(null);
    const [timeSpentByTask, setTimeSpentByTask] = useState({});

    const [usageSummary, setUsageSummary] = useState({
        topRoutes: [],
        totalVisits: 0,
        totalMinutes: 0
    });

    useEffect(() => {
        const loadTasks = async () => {
            try {
                await fetchTasks();
            } catch (taskError) {
                console.error('Failed to load dashboard tasks:', taskError);
            }
        };

        loadTasks();
    }, [fetchTasks]);

    useEffect(() => {
        setUsageSummary(usageService.getUsageSummary());
    }, [tasks.length]);

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(TASK_TIME_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            setTimeSpentByTask(parsed);
        } catch {
            setTimeSpentByTask({});
        }
    }, []);

    const taskStats = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter((task) => task.status === 'completed').length;
        const pending = tasks.filter((task) => task.status === 'pending').length;
        const inProgress = tasks.filter((task) => task.status === 'in_progress').length;
        const totalScheduledMinutes = tasks.reduce(
            (acc, task) => acc + (parseInt(task.duration_minutes, 10) || 0),
            0
        );

        const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
        const avgTaskDuration = total > 0 ? (totalScheduledMinutes / total).toFixed(1) : '0.0';

        return {
            total,
            completed,
            pending,
            inProgress,
            totalScheduledMinutes,
            completionRate,
            avgTaskDuration
        };
    }, [tasks]);

    const timeAnalysis = useMemo(() => {
        const buckets = {
            morning: 0,
            afternoon: 0,
            evening: 0,
            night: 0
        };

        tasks.forEach((task) => {
            if (!task.scheduled_time) return;
            const hour = parseInt(task.scheduled_time.split(':')[0], 10);
            if (Number.isNaN(hour)) return;

            if (hour >= 5 && hour <= 11) buckets.morning += 1;
            else if (hour >= 12 && hour <= 17) buckets.afternoon += 1;
            else if (hour >= 18 && hour <= 21) buckets.evening += 1;
            else buckets.night += 1;
        });

        const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
        const [topName, topCount] = entries[0] || ['none', 0];

        return {
            buckets,
            topBucket: topCount > 0 ? `${topName} (${topCount} tasks)` : 'Not enough scheduled data'
        };
    }, [tasks]);

    const selectedDateTasks = useMemo(() => {
        return tasks
            .filter((task) => task.scheduled_date === selectedDate)
            .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''));
    }, [selectedDate, tasks]);

    const currentActiveElapsedSeconds = useMemo(() => {
        if (!activeTimerTaskId || !timerStartedAt) return 0;
        return Math.floor((Date.now() - timerStartedAt) / 1000);
    }, [activeTimerTaskId, timerStartedAt]);

    const trackedSecondsTotal = useMemo(() => {
        return Object.values(timeSpentByTask).reduce((acc, val) => acc + (Number(val) || 0), 0);
    }, [timeSpentByTask]);

    const saveTrackedTime = (updatedMap) => {
        setTimeSpentByTask(updatedMap);
        localStorage.setItem(TASK_TIME_STORAGE_KEY, JSON.stringify(updatedMap));
    };

    const handleCalendarInputChange = (event) => {
        const { name, value } = event.target;
        setCalendarForm((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCreateTaskFromCalendar = async (event) => {
        event.preventDefault();
        setCalendarError('');

        if (!calendarForm.title.trim()) {
            setCalendarError('Task title is required.');
            return;
        }

        try {
            setSavingCalendarTask(true);
            await createTask({
                title: calendarForm.title.trim(),
                scheduled_date: selectedDate,
                scheduled_time: calendarForm.scheduled_time ? `${calendarForm.scheduled_time}:00` : null,
                duration_minutes: calendarForm.duration_minutes ? parseInt(calendarForm.duration_minutes, 10) : null,
                priority: calendarForm.priority
            });

            await fetchTasks();
            setCalendarForm({
                title: '',
                scheduled_time: '',
                duration_minutes: '30',
                priority: 'medium'
            });
        } catch (createError) {
            const validationMessage = createError?.errors?.[0]?.message;
            setCalendarError(validationMessage || createError?.message || 'Could not create task.');
        } finally {
            setSavingCalendarTask(false);
        }
    };

    const startTaskTimer = (taskId) => {
        if (activeTimerTaskId && activeTimerTaskId !== taskId) {
            stopTaskTimer();
        }

        setActiveTimerTaskId(taskId);
        setTimerStartedAt(Date.now());
    };

    const stopTaskTimer = () => {
        if (!activeTimerTaskId || !timerStartedAt) {
            setActiveTimerTaskId(null);
            setTimerStartedAt(null);
            return;
        }

        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000));
        const prevSeconds = Number(timeSpentByTask[activeTimerTaskId]) || 0;
        const updatedMap = {
            ...timeSpentByTask,
            [activeTimerTaskId]: prevSeconds + elapsedSeconds
        };

        saveTrackedTime(updatedMap);
        setActiveTimerTaskId(null);
        setTimerStartedAt(null);
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header-row">
                <h1>Dashboard</h1>
                <div className="dashboard-live-clock card">
                    <p className="clock-date">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <p className="clock-time">{now.toLocaleTimeString()}</p>
                </div>
            </div>

            <div className="dashboard-profile card">
                <h2>Profile</h2>
                <div className="profile-grid">
                    <div><span className="profile-label">Name</span><p>{user?.name || '—'}</p></div>
                    <div><span className="profile-label">Email</span><p>{user?.email || '—'}</p></div>
                    <div><span className="profile-label">Timezone</span><p>{user?.timezone || 'UTC'}</p></div>
                    <div><span className="profile-label">Total tasks</span><p>{taskStats.total}</p></div>
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-card stats-card" onClick={() => navigate('/tasks')}>
                    <h3>Task Summary</h3>
                    <p><strong>{taskStats.completed}</strong> completed • <strong>{taskStats.pending}</strong> pending • <strong>{taskStats.inProgress}</strong> in progress</p>
                    <p>Completion rate: <strong>{taskStats.completionRate}%</strong></p>
                </div>

                <div className="dashboard-card stats-card" onClick={() => navigate('/today')}>
                    <h3>Time Analysis</h3>
                    <p>Total scheduled time: <strong>{taskStats.totalScheduledMinutes} min</strong></p>
                    <p>Average task duration: <strong>{taskStats.avgTaskDuration} min</strong></p>
                    <p>Peak schedule window: <strong>{timeAnalysis.topBucket}</strong></p>
                    <p>Tracked focus time: <strong>{Math.round(trackedSecondsTotal / 60)} min</strong></p>
                </div>

                <div className="dashboard-card stats-card" onClick={() => navigate('/today')}>
                    <h3>Most Used Parts</h3>
                    {usageSummary.topRoutes.length === 0 ? (
                        <p>No usage data yet. Navigate through the app to build insights.</p>
                    ) : (
                        <ul className="compact-list">
                            {usageSummary.topRoutes.map((item) => (
                                <li key={item.path}>
                                    <span>{item.label}</span>
                                    <span>{item.visits} visits • {item.totalMinutes} min</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="usage-total">Total tracked navigation: <strong>{usageSummary.totalVisits}</strong> visits</p>
                </div>

                <div className="dashboard-card" onClick={() => navigate('/week')}>
                    <h3>Week View</h3>
                    <p>Open weekly planning view.</p>
                </div>
            </div>

            <section className="dashboard-calendar card">
                <div className="dashboard-section-header">
                    <h2>Calendar + Task Clock</h2>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="calendar-date-input"
                    />
                </div>

                <form className="calendar-task-form" onSubmit={handleCreateTaskFromCalendar}>
                    <input
                        className="input"
                        type="text"
                        name="title"
                        value={calendarForm.title}
                        onChange={handleCalendarInputChange}
                        placeholder="Quick add task title"
                        maxLength={255}
                        required
                    />
                    <input
                        className="input"
                        type="time"
                        name="scheduled_time"
                        value={calendarForm.scheduled_time}
                        onChange={handleCalendarInputChange}
                    />
                    <input
                        className="input"
                        type="number"
                        name="duration_minutes"
                        value={calendarForm.duration_minutes}
                        onChange={handleCalendarInputChange}
                        min="1"
                        max="1440"
                    />
                    <select
                        className="input"
                        name="priority"
                        value={calendarForm.priority}
                        onChange={handleCalendarInputChange}
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                    <button className="btn btn-primary" type="submit" disabled={savingCalendarTask}>
                        {savingCalendarTask ? 'Saving...' : 'Add to Calendar'}
                    </button>
                </form>

                {calendarError && <p className="dashboard-error">{calendarError}</p>}

                <div className="calendar-task-list">
                    {selectedDateTasks.length === 0 ? (
                        <p className="muted">No tasks on this date. Create one above.</p>
                    ) : (
                        selectedDateTasks.map((task) => {
                            const persistedSeconds = Number(timeSpentByTask[task.id]) || 0;
                            const runningSeconds = activeTimerTaskId === task.id ? currentActiveElapsedSeconds : 0;
                            const totalSeconds = persistedSeconds + runningSeconds;
                            const isRunning = activeTimerTaskId === task.id;

                            return (
                                <div className="calendar-task-item" key={task.id}>
                                    <div>
                                        <p className="calendar-task-title">{task.title}</p>
                                        <p className="calendar-task-meta">
                                            {task.scheduled_time || 'Any time'} • {task.priority || 'medium'} • {task.status}
                                        </p>
                                    </div>
                                    <div className="calendar-task-timer">
                                        <span>{formatElapsed(totalSeconds)}</span>
                                        <button
                                            className={`btn ${isRunning ? 'btn-danger' : 'btn-secondary'}`}
                                            type="button"
                                            onClick={isRunning ? stopTaskTimer : () => startTaskTimer(task.id)}
                                        >
                                            {isRunning ? 'Stop' : 'Start'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>

            <section className="dashboard-tasks card">
                <div className="dashboard-section-header">
                    <h2>All Tasks</h2>
                    <button className="dashboard-link-btn" onClick={() => navigate('/tasks')}>Open full task page</button>
                </div>

                {loading && <p className="muted">Loading tasks...</p>}
                {error && <p className="dashboard-error">{error}</p>}

                {!loading && tasks.length === 0 && (
                    <p className="muted">No tasks yet. Add one from Today view.</p>
                )}

                {tasks.length > 0 && (
                    <div className="dashboard-task-table-wrap">
                        <table className="dashboard-task-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Status</th>
                                    <th>Priority</th>
                                    <th>Date</th>
                                    <th>Time</th>
                                        <th>Duration</th>
                                        <th>Tracked</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tasks.map((task) => (
                                    <tr key={task.id}>
                                        <td>{task.title}</td>
                                        <td>{task.status}</td>
                                        <td>{task.priority || 'medium'}</td>
                                        <td>{task.scheduled_date || '-'}</td>
                                        <td>{task.scheduled_time || '-'}</td>
                                        <td>{task.duration_minutes ? `${task.duration_minutes} min` : '-'}</td>
                                        <td>{formatElapsed(Number(timeSpentByTask[task.id]) || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
};

export default Dashboard;
