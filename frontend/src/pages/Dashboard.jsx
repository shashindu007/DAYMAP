import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useTasks } from '../context/TaskContext';
import taskService from '../services/taskService';
import './Dashboard.css';

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

const formatClock = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const displayTaskDateTime = (task) => {
    if (!task?.scheduled_date) return 'Unscheduled';
    return `${task.scheduled_date}${task.scheduled_time ? ` • ${toHm(task.scheduled_time)}` : ''}`;
};

const Dashboard = () => {
    const { tasks, fetchTasks, createDaySchedule } = useTasks();

    const [now, setNow] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [upcomingTasks, setUpcomingTasks] = useState([]);
    const [loadingUpcoming, setLoadingUpcoming] = useState(false);
    const [dashboardError, setDashboardError] = useState('');

    const todayYmd = useMemo(() => toYmd(new Date()), []);
    const selectedYmd = useMemo(() => toYmd(selectedDate), [selectedDate]);

    const upcomingFromTasks = useMemo(() => {
        const end = new Date();
        end.setDate(end.getDate() + 7);
        const endYmd = toYmd(end);

        return tasks
            .filter((task) => {
                if (!['pending', 'in_progress'].includes(task.status)) return false;
                if (!task.scheduled_date) return false;
                return task.scheduled_date >= todayYmd && task.scheduled_date <= endYmd;
            })
            .sort((a, b) => {
                const dateCompare = (a.scheduled_date || '').localeCompare(b.scheduled_date || '');
                if (dateCompare !== 0) return dateCompare;
                return (a.scheduled_time || '').localeCompare(b.scheduled_time || '');
            })
            .slice(0, 3);
    }, [tasks, todayYmd]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const loadDashboardData = useCallback(async () => {
        try {
            setDashboardError('');
            await fetchTasks();

            setLoadingUpcoming(true);
            const upcomingResponse = await taskService.getUpcomingTasks();
            const normalizedUpcoming = (upcomingResponse?.data?.tasks || [])
                .filter((task) => ['pending', 'in_progress'].includes(task.status))
                .slice(0, 3);
            setUpcomingTasks(normalizedUpcoming);
        } catch (error) {
            const message = error?.message || 'Failed to load dashboard data';
            if (process.env.NODE_ENV === 'development' && /too many requests/i.test(message)) {
                return;
            }
            setDashboardError(message);
        } finally {
            setLoadingUpcoming(false);
        }
    }, [fetchTasks]);

    useEffect(() => {
        if (upcomingFromTasks.length > 0) {
            setUpcomingTasks(upcomingFromTasks);
        }
    }, [upcomingFromTasks]);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    const selectedDateTaskCount = useMemo(() => (
        tasks.filter((task) => task.scheduled_date === selectedYmd).length
    ), [selectedYmd, tasks]);

    const selectedDateTaskPreview = useMemo(() => (
        tasks
            .filter((task) => task.scheduled_date === selectedYmd)
            .sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))
            .slice(0, 3)
    ), [selectedYmd, tasks]);

    const handleScheduleTomorrow = async () => {
        setDashboardError('');

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowYmd = toYmd(tomorrow);

        const sourceTasks = tasks
            .filter((task) => task.scheduled_date === todayYmd && ['pending', 'in_progress'].includes(task.status));

        if (sourceTasks.length === 0) {
            setDashboardError('No pending or in-progress tasks from today to schedule for tomorrow.');
            return;
        }

        const slots = sourceTasks.map((task) => ({
            title: task.title,
            start_time: toHm(task.scheduled_time),
            priority: task.priority || 'medium',
            category: task.category || '',
            description: task.description || '',
            duration_minutes: task.duration_minutes || null
        }));

        try {
            await createDaySchedule({
                date: tomorrowYmd,
                slots,
                replaceExisting: false
            });
            await loadDashboardData();
            setDashboardError('');
        } catch (error) {
            const validationMessage = error?.errors?.[0]?.message;
            setDashboardError(validationMessage || error?.message || 'Failed to schedule tasks for tomorrow.');
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header-row">
                <h1>Dashboard</h1>
                <div className="dashboard-live-clock card">
                    <p className="clock-date">
                        {now.toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </p>
                    <p className="clock-time">{formatClock(now)}</p>
                </div>
            </div>

            {dashboardError && <p className="dashboard-error">{dashboardError}</p>}

            <section className="dashboard-calendar card">
                <div className="dashboard-section-header">
                    <h2>Calendar</h2>
                    <button className="btn btn-primary" type="button" onClick={handleScheduleTomorrow}>
                        Schedule Tomorrow
                    </button>
                </div>

                <div className="dashboard-calendar-grid">
                    <Calendar
                        onChange={(value) => setSelectedDate(value instanceof Date ? value : new Date())}
                        value={selectedDate}
                    />
                    <div className="calendar-insight-card">
                        <p className="calendar-selected-date">Selected: <strong>{selectedYmd}</strong></p>
                        <p className="muted">Tasks planned: <strong>{selectedDateTaskCount}</strong></p>

                        <div className="calendar-task-preview">
                            {selectedDateTaskPreview.length === 0 ? (
                                <p className="muted">No tasks on this date.</p>
                            ) : (
                                selectedDateTaskPreview.map((task) => (
                                    <div key={task.id} className="calendar-task-preview-item">
                                        <span>{task.title}</span>
                                        <small>{toHm(task.scheduled_time) || 'Any time'}</small>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="dashboard-card upcoming-card">
                <div className="dashboard-section-header">
                    <h2>Upcoming Tasks</h2>
                    <span className="muted">Next 2–3 tasks</span>
                </div>

                {loadingUpcoming && upcomingTasks.length === 0 ? (
                    <p className="muted">Loading upcoming tasks...</p>
                ) : upcomingTasks.length === 0 ? (
                    <p className="muted">No upcoming tasks found for the next week.</p>
                ) : (
                    <ul className="upcoming-list">
                        {upcomingTasks.map((task) => (
                            <li key={task.id}>
                                <div>
                                    <p className="upcoming-title">{task.title}</p>
                                    <p className="upcoming-meta">{displayTaskDateTime(task)}</p>
                                </div>
                                <span className={`task-priority priority-${task.priority || 'medium'}`}>
                                    {task.priority || 'medium'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default Dashboard;
