import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../context/TaskContext';
import Button from '../components/common/Button';
import './Tasks.css';

const Tasks = () => {
    const navigate = useNavigate();
    const { tasks, loading, error, fetchTasks, updateTask, deleteTask } = useTasks();
    const [statusFilter, setStatusFilter] = useState('all');
    const [query, setQuery] = useState('');

    useEffect(() => {
        const loadTasks = async () => {
            try {
                await fetchTasks();
            } catch (loadError) {
                console.error('Failed to load tasks:', loadError);
            }
        };

        loadTasks();
    }, [fetchTasks]);

    const handleStatusChange = async (task, nextStatus) => {
        try {
            await updateTask(task.id, { status: nextStatus });
        } catch (updateError) {
            console.error('Failed to update task status:', updateError);
        }
    };

    const handleDelete = async (taskId) => {
        const shouldDelete = window.confirm('Delete this task? This action cannot be undone.');
        if (!shouldDelete) return;

        try {
            await deleteTask(taskId);
        } catch (deleteError) {
            console.error('Failed to delete task:', deleteError);
        }
    };

    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
            const normalizedQuery = query.trim().toLowerCase();
            const matchesQuery =
                !normalizedQuery ||
                task.title.toLowerCase().includes(normalizedQuery) ||
                (task.description || '').toLowerCase().includes(normalizedQuery);

            return matchesStatus && matchesQuery;
        });
    }, [tasks, statusFilter, query]);

    return (
        <div className="tasks-page">
            <div className="tasks-page-header">
                <h1>All Tasks</h1>
                <div className="tasks-header-actions">
                    <Button variant="secondary" onClick={() => navigate('/today')}>
                        Today
                    </Button>
                    <Button variant="primary" onClick={() => navigate('/today')}>
                        + New Task
                    </Button>
                </div>
            </div>

            <div className="tasks-toolbar">
                <input
                    className="tasks-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by title or description"
                />
                <select
                    className="tasks-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {loading && <p className="tasks-feedback">Loading tasks...</p>}
            {error && <p className="tasks-feedback tasks-error">{error}</p>}

            {!loading && filteredTasks.length === 0 && (
                <div className="tasks-empty">
                    <p>No tasks found for the current filter.</p>
                    <Button variant="primary" onClick={() => navigate('/today')}>
                        Create a task
                    </Button>
                </div>
            )}

            <div className="tasks-list-grid">
                {filteredTasks.map((task) => (
                    <article key={task.id} className="tasks-card">
                        <div className="tasks-card-top">
                            <h3>{task.title}</h3>
                            <span className={`tasks-pill tasks-pill-${task.status}`}>{task.status.replace('_', ' ')}</span>
                        </div>

                        {task.description && <p className="tasks-card-desc">{task.description}</p>}

                        <div className="tasks-meta-row">
                            {task.scheduled_date && <span>📅 {task.scheduled_date}</span>}
                            {task.scheduled_time && <span>⏰ {task.scheduled_time}</span>}
                            {task.duration_minutes && <span>⏱ {task.duration_minutes} min</span>}
                        </div>

                        <div className="tasks-card-actions">
                            {task.status !== 'completed' && (
                                <Button
                                    variant="secondary"
                                    onClick={() => handleStatusChange(task, 'completed')}
                                >
                                    Mark done
                                </Button>
                            )}
                            <Button variant="danger" onClick={() => handleDelete(task.id)}>
                                Delete
                            </Button>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
};

export default Tasks;
