import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TaskContext';
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

const getInitials = (name) => {
    const normalized = (name || '').trim();
    if (!normalized) return 'U';

    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { tasks, loading, error, fetchTasks, createTask, createDaySchedule } = useTasks();
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
    const [dayScheduleError, setDayScheduleError] = useState('');
    const [dayScheduleMessage, setDayScheduleMessage] = useState('');
    const [savingDaySchedule, setSavingDaySchedule] = useState(false);
    const [replaceExistingSchedule, setReplaceExistingSchedule] = useState(false);
    const [daySlots, setDaySlots] = useState([
        { title: '', start_time: '', end_time: '', priority: 'medium', category: '' }
    ]);

    const [activeTimerTaskId, setActiveTimerTaskId] = useState(null);
    const [timerStartedAt, setTimerStartedAt] = useState(null);
    const [timeSpentByTask, setTimeSpentByTask] = useState({});

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

    const profileSummary = useMemo(() => {
        const completedToday = tasks.filter((task) => task.scheduled_date === today && task.status === 'completed').length;
        const plannedToday = tasks.filter((task) => task.scheduled_date === today).length;
        const overdue = tasks.filter((task) => task.scheduled_date && task.scheduled_date < today && task.status !== 'completed').length;
        const memberSince = user?.created_at
            ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
            : 'Today';

        return {
            initials: getInitials(user?.name),
            completedToday,
            plannedToday,
            overdue,
            memberSince
        };
    }, [tasks, today, user]);

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

    const updateDaySlot = (index, field, value) => {
        setDaySlots((prev) => prev.map((slot, slotIndex) => (
            slotIndex === index ? { ...slot, [field]: value } : slot
        )));
    };

    const addDaySlot = () => {
        setDaySlots((prev) => ([
            ...prev,
            { title: '', start_time: '', end_time: '', priority: 'medium', category: '' }
        ]));
    };

    const removeDaySlot = (index) => {
        setDaySlots((prev) => prev.filter((_, slotIndex) => slotIndex !== index));
    };

    const handleCreateDaySchedule = async (event) => {
        event.preventDefault();
        setDayScheduleError('');
        setDayScheduleMessage('');

        const normalizedSlots = daySlots
            .map((slot) => ({
                ...slot,
                title: slot.title.trim(),
                category: slot.category.trim()
            }))
            .filter((slot) => slot.title);

        if (normalizedSlots.length === 0) {
            setDayScheduleError('Add at least one slot with a title to build your day schedule.');
            return;
        }

        try {
            setSavingDaySchedule(true);
            const response = await createDaySchedule({
                date: selectedDate,
                slots: normalizedSlots,
                replaceExisting: replaceExistingSchedule
            });

            setDayScheduleMessage(`Saved ${response?.data?.count || normalizedSlots.length} slot(s) for ${selectedDate}.`);
            setDaySlots([{ title: '', start_time: '', end_time: '', priority: 'medium', category: '' }]);
            await fetchTasks();
        } catch (scheduleError) {
            const validationMessage = scheduleError?.errors?.[0]?.message;
            setDayScheduleError(validationMessage || scheduleError?.message || 'Failed to create full-day schedule.');
        } finally {
            setSavingDaySchedule(false);
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
                <div className="profile-header">
                    {user?.profile_image ? (
                        <img src={user.profile_image} alt="Profile" className="profile-avatar" style={{ objectFit: 'cover' }} />
                    ) : (
                        <div className="profile-avatar" aria-hidden="true">{profileSummary.initials}</div>
                    )}
                    <div>
                        <h2 className="profile-name">{user?.name || 'User Profile'}</h2>
                        <p className="profile-subtitle">Plan smarter and schedule your day with confidence.</p>
                    </div>
                </div>
                <div className="profile-grid">
                    <div><span className="profile-label">Name</span><p>{user?.name || '—'}</p></div>
                    <div><span className="profile-label">Email</span><p>{user?.email || '—'}</p></div>
                    <div><span className="profile-label">Timezone</span><p>{user?.timezone || 'UTC'}</p></div>
                    <div><span className="profile-label">Phone</span><p>{user?.phone || '—'}</p></div>
                    <div><span className="profile-label">Location</span><p>{user?.location || '—'}</p></div>
                    <div><span className="profile-label">Member since</span><p>{profileSummary.memberSince}</p></div>
                    <div><span className="profile-label">Total tasks</span><p>{taskStats.total}</p></div>
                    <div><span className="profile-label">Planned today</span><p>{profileSummary.plannedToday}</p></div>
                    <div><span className="profile-label">Completed today</span><p>{profileSummary.completedToday}</p></div>
                    <div><span className="profile-label">Overdue tasks</span><p>{profileSummary.overdue}</p></div>
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-card stats-card" onClick={() => navigate('/tasks')}>
                    <h3>Daily Progress Overview</h3>
                    <p><strong>{taskStats.completed}</strong> completed • <strong>{taskStats.pending}</strong> pending • <strong>{taskStats.inProgress}</strong> in progress</p>
                    <p>Completion rate: <strong>{taskStats.completionRate}%</strong></p>
                    <p>Total scheduled time: <strong>{taskStats.totalScheduledMinutes} min</strong></p>
                    <p>Tracked focus time: <strong>{Math.round(trackedSecondsTotal / 60)} min</strong></p>
                </div>
            </div>

            <section className="dashboard-calendar card">
                <div className="dashboard-section-header">
                    <h2>Full-Day Scheduler</h2>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="calendar-date-input"
                    />
                </div>

                <form onSubmit={handleCreateDaySchedule} className="calendar-task-list">
                    {daySlots.map((slot, index) => (
                        <div className="calendar-task-item" key={`day-slot-${index}`}>
                            <div className="calendar-task-slot-grid">
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Task title"
                                    value={slot.title}
                                    onChange={(e) => updateDaySlot(index, 'title', e.target.value)}
                                    maxLength={255}
                                />
                                <input
                                    className="input"
                                    type="time"
                                    value={slot.start_time}
                                    onChange={(e) => updateDaySlot(index, 'start_time', e.target.value)}
                                />
                                <input
                                    className="input"
                                    type="time"
                                    value={slot.end_time}
                                    onChange={(e) => updateDaySlot(index, 'end_time', e.target.value)}
                                />
                                <select
                                    className="input"
                                    value={slot.priority}
                                    onChange={(e) => updateDaySlot(index, 'priority', e.target.value)}
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Category"
                                    value={slot.category}
                                    onChange={(e) => updateDaySlot(index, 'category', e.target.value)}
                                />
                            </div>
                            <div className="calendar-task-timer">
                                {daySlots.length > 1 && (
                                    <button type="button" className="btn btn-danger" onClick={() => removeDaySlot(index)}>
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    <div className="dashboard-section-header">
                        <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                                type="checkbox"
                                checked={replaceExistingSchedule}
                                onChange={(e) => setReplaceExistingSchedule(e.target.checked)}
                            />
                            Replace existing tasks on this date
                        </label>
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={addDaySlot}>Add Slot</button>
                            <button type="submit" className="btn btn-primary" disabled={savingDaySchedule}>
                                {savingDaySchedule ? 'Saving...' : 'Save Full-Day Plan'}
                            </button>
                        </div>
                    </div>
                </form>

                {dayScheduleError && <p className="dashboard-error">{dayScheduleError}</p>}
                {dayScheduleMessage && <p className="muted">{dayScheduleMessage}</p>}
            </section>

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
