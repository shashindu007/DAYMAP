import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TaskContext';
import usageService from '../services/usageService';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { tasks, loading, error, fetchTasks } = useTasks();
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

    return (
        <div className="dashboard-container">
            <div className="dashboard-header-row">
                <h1>Dashboard</h1>
                <div className="dashboard-nav-actions">
                    <button className="dashboard-link-btn" onClick={() => navigate('/today')}>Today</button>
                    <button className="dashboard-link-btn" onClick={() => navigate('/tasks')}>Tasks</button>
                    <button className="dashboard-link-btn" onClick={() => navigate('/settings')}>Settings</button>
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
