import React, { useEffect, useState } from 'react';
import { useTasks } from '../context/TaskContext';
import Button from '../components/common/Button';
import './TodayView.css';

const TodayView = () => {
    const { tasks, loading, fetchTodayTasks, completeTask } = useTasks();
    const [stats, setStats] = useState({
        total: 0,
        completed: 0,
        percentage: 0
    });

    useEffect(() => {
        loadTodayTasks();
    }, []);

    useEffect(() => {
        if (tasks.length > 0) {
            const completed = tasks.filter(t => t.status === 'completed').length;
            setStats({
                total: tasks.length,
                completed,
                percentage: (completed / tasks.length) * 100
            });
        }
    }, [tasks]);

    const loadTodayTasks = async () => {
        try {
            await fetchTodayTasks();
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    };

    const handleComplete = async (taskId) => {
        try {
            await completeTask(taskId);
        } catch (error) {
            console.error('Error completing task:', error);
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
                <h1>Today's Tasks</h1>
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
                        <Button variant="primary">Add Task</Button>
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
                                        <span className="task-time">⏰ {task.scheduled_time}</span>
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
    );
};

export default TodayView;
