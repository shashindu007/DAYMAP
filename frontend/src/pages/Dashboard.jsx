import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useSchedule } from '../context/ScheduleContext';
import ScheduleEditor from '../components/schedule/ScheduleEditor';
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
    return `${task.scheduled_date}${task.slot_start_time ? ` • ${toHm(task.slot_start_time)}` : ''}`;
};

const Dashboard = () => {
    const { scheduleByDate, fetchSchedule, saveSchedule, fetchScheduleRange } = useSchedule();

    const [searchParams, setSearchParams] = useSearchParams();

    const [now, setNow] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [upcomingTasks, setUpcomingTasks] = useState([]);
    const [loadingUpcoming, setLoadingUpcoming] = useState(false);
    const [dashboardError, setDashboardError] = useState('');
    const [editingDate, setEditingDate] = useState(null);
    const [savingSchedule, setSavingSchedule] = useState(false);

    const selectedYmd = useMemo(() => toYmd(selectedDate), [selectedDate]);

    const scheduleForSelectedDate = scheduleByDate[selectedYmd]?.tasks || [];

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const loadUpcomingSchedules = useCallback(async () => {
        const today = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 7);
        const startYmd = toYmd(today);
        const endYmd = toYmd(end);

        try {
            setLoadingUpcoming(true);
            const upcoming = await fetchScheduleRange(startYmd, endYmd);
            const normalizedUpcoming = upcoming
                .filter((task) => ['pending', 'in_progress'].includes(task.status))
                .slice(0, 3);
            setUpcomingTasks(normalizedUpcoming);
        } catch (error) {
            const message = error?.message || 'Failed to load upcoming schedules';
            setDashboardError(message);
        } finally {
            setLoadingUpcoming(false);
        }
    }, [fetchScheduleRange]);

    useEffect(() => {
        fetchSchedule(selectedYmd).catch(() => null);
    }, [fetchSchedule, selectedYmd]);

    useEffect(() => {
        if (editingDate) {
            fetchSchedule(editingDate).catch(() => null);
        }
    }, [editingDate, fetchSchedule]);

    useEffect(() => {
        if (editingDate) {
            setSelectedDate(new Date(`${editingDate}T00:00:00`));
        }
    }, [editingDate]);

    useEffect(() => {
        const editDate = searchParams.get('edit');
        if (!editDate) return;
        setEditingDate(editDate);
        setSelectedDate(new Date(`${editDate}T00:00:00`));
    }, [searchParams]);

    useEffect(() => {
        loadUpcomingSchedules();
    }, [loadUpcomingSchedules]);

    const selectedDateTaskCount = useMemo(() => (
        scheduleForSelectedDate.length
    ), [scheduleForSelectedDate]);

    const selectedDateTaskPreview = useMemo(() => (
        scheduleForSelectedDate
            .slice()
            .sort((a, b) => (a.slot_start_time || '').localeCompare(b.slot_start_time || ''))
            .slice(0, 3)
    ), [scheduleForSelectedDate]);

    const handleScheduleTomorrow = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowYmd = toYmd(tomorrow);
        setSelectedDate(tomorrow);
        setEditingDate(tomorrowYmd);
    };

    const handleEditSelectedDate = () => {
        setEditingDate(selectedYmd);
    };

    const handleCloseEditor = () => {
        setEditingDate(null);
        if (searchParams.get('edit')) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('edit');
            setSearchParams(nextParams);
        }
    };

    const handleSaveSchedule = async (slots) => {
        if (!editingDate) return;
        setDashboardError('');
        try {
            setSavingSchedule(true);
            await saveSchedule(editingDate, slots, true);
            await fetchSchedule(editingDate);
            await loadUpcomingSchedules();
            setSelectedDate(new Date(`${editingDate}T00:00:00`));
            setEditingDate(null);
        } catch (error) {
            const validationMessage = error?.errors?.[0]?.message;
            setDashboardError(validationMessage || error?.message || 'Failed to save schedule.');
        } finally {
            setSavingSchedule(false);
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

                        <button className="btn btn-outline" type="button" onClick={handleEditSelectedDate}>
                            Edit Schedule
                        </button>

                        <div className="calendar-task-preview">
                            {selectedDateTaskPreview.length === 0 ? (
                                <p className="muted">No tasks on this date.</p>
                            ) : (
                                selectedDateTaskPreview.map((task) => (
                                    <div key={task.id} className="calendar-task-preview-item">
                                        <span>{task.title}</span>
                                        <small>{toHm(task.slot_start_time) || 'Any time'}</small>
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

            {editingDate && (
                <ScheduleEditor
                    date={editingDate}
                    tasks={scheduleByDate[editingDate]?.tasks || []}
                    onSave={handleSaveSchedule}
                    onClose={handleCloseEditor}
                    saving={savingSchedule}
                />
            )}
        </div>
    );
};

export default Dashboard;
