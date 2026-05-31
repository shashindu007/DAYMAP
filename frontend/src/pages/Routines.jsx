import React, { useEffect, useMemo, useState } from 'react';
import { useSchedule } from '../context/ScheduleContext';
import routineService from '../services/routineService';
import './Routines.css';

const Routines = () => {
    const { fetchSchedule } = useSchedule();
    const [routines, setRoutines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [applyDate, setApplyDate] = useState(new Date().toISOString().split('T')[0]);
    const [form, setForm] = useState({
        name: '',
        description: '',
        routine_type: 'custom',
        tasks: [{ title: '', priority: 'medium', scheduled_time: '', duration_minutes: '' }]
    });

    const loadRoutines = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await routineService.getAllRoutines();
            setRoutines(response?.data?.routines || []);
        } catch (loadError) {
            setError(loadError?.message || 'Failed to load routines');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRoutines();
    }, []);

    const isBusy = loading || saving;

    const activeCount = useMemo(() => routines.filter((item) => item.is_active).length, [routines]);

    const handleField = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleTemplateTaskChange = (index, field, value) => {
        setForm((prev) => {
            const copy = [...prev.tasks];
            copy[index] = { ...copy[index], [field]: value };
            return { ...prev, tasks: copy };
        });
    };

    const addTemplateTask = () => {
        setForm((prev) => ({
            ...prev,
            tasks: [...prev.tasks, { title: '', priority: 'medium', scheduled_time: '', duration_minutes: '' }]
        }));
    };

    const removeTemplateTask = (index) => {
        setForm((prev) => ({
            ...prev,
            tasks: prev.tasks.filter((_, taskIdx) => taskIdx !== index)
        }));
    };

    const createRoutine = async (event) => {
        event.preventDefault();
        setError('');

        if (!form.name.trim()) {
            setError('Routine name is required.');
            return;
        }

        const cleanedTasks = form.tasks
            .filter((task) => task.title.trim())
            .map((task) => ({
                title: task.title.trim(),
                priority: task.priority,
                scheduled_time: task.scheduled_time ? `${task.scheduled_time}:00` : null,
                duration_minutes: task.duration_minutes ? parseInt(task.duration_minutes, 10) : null
            }));

        try {
            setSaving(true);
            await routineService.createRoutine({
                name: form.name.trim(),
                description: form.description.trim() || null,
                routine_type: form.routine_type,
                tasks: cleanedTasks
            });
            setForm({
                name: '',
                description: '',
                routine_type: 'custom',
                tasks: [{ title: '', priority: 'medium', scheduled_time: '', duration_minutes: '' }]
            });
            await loadRoutines();
        } catch (createError) {
            const validationMessage = createError?.errors?.[0]?.message;
            setError(validationMessage || createError?.message || 'Failed to create routine');
        } finally {
            setSaving(false);
        }
    };

    const applyRoutine = async (routineId) => {
        try {
            setError('');
            await routineService.applyRoutine(routineId, { date: applyDate });
            if (applyDate) {
                await fetchSchedule(applyDate);
            }
            await loadRoutines();
        } catch (applyError) {
            setError(applyError?.message || 'Could not apply routine');
        }
    };

    const toggleRoutine = async (routineId) => {
        try {
            await routineService.toggleActive(routineId);
            await loadRoutines();
        } catch (toggleError) {
            setError(toggleError?.message || 'Could not toggle routine status');
        }
    };

    const deleteRoutine = async (routineId) => {
        try {
            await routineService.deleteRoutine(routineId);
            await loadRoutines();
        } catch (deleteError) {
            setError(deleteError?.message || 'Could not delete routine');
        }
    };

    return (
        <div className="routines-page">
            <div className="routines-header">
                <h1>Routines</h1>
                <p>Create reusable routine templates and apply them to your day.</p>
            </div>

            <div className="routines-meta card">
                <p><strong>{routines.length}</strong> routines • <strong>{activeCount}</strong> active</p>
                <label>
                    Apply date:
                    <input type="date" value={applyDate} onChange={(e) => setApplyDate(e.target.value)} />
                </label>
            </div>

            <form className="card routine-form" onSubmit={createRoutine} aria-busy={saving}>
                <h2>Create Routine</h2>
                <input
                    className="input"
                    name="name"
                    value={form.name}
                    onChange={handleField}
                    placeholder="Routine name"
                    maxLength={100}
                    required
                />
                <textarea
                    className="input"
                    name="description"
                    value={form.description}
                    onChange={handleField}
                    placeholder="Description (optional)"
                    rows={2}
                />
                <select className="input" name="routine_type" value={form.routine_type} onChange={handleField}>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                    <option value="custom">Custom</option>
                </select>

                <h3>Template Tasks</h3>
                {form.tasks.map((task, idx) => (
                    <div className="routine-task-row" key={`template-task-${idx}`}>
                        <input
                            className="input"
                            placeholder="Task title"
                            value={task.title}
                            onChange={(e) => handleTemplateTaskChange(idx, 'title', e.target.value)}
                            maxLength={255}
                        />
                        <select
                            className="input"
                            value={task.priority}
                            onChange={(e) => handleTemplateTaskChange(idx, 'priority', e.target.value)}
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                        <input
                            className="input"
                            type="time"
                            value={task.scheduled_time}
                            onChange={(e) => handleTemplateTaskChange(idx, 'scheduled_time', e.target.value)}
                        />
                        <input
                            className="input"
                            type="number"
                            min="1"
                            max="1440"
                            placeholder="Duration"
                            value={task.duration_minutes}
                            onChange={(e) => handleTemplateTaskChange(idx, 'duration_minutes', e.target.value)}
                        />
                        <button className="btn btn-outline" type="button" onClick={() => removeTemplateTask(idx)}>
                            Remove
                        </button>
                    </div>
                ))}

                <div className="routine-form-actions">
                    <button className="btn btn-secondary" type="button" onClick={addTemplateTask} disabled={saving}>
                        Add Template Task
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>
                        {saving ? 'Saving...' : 'Create Routine'}
                    </button>
                </div>
            </form>

            {error && (
                <p className="dashboard-error" role="alert" aria-live="polite">
                    {error}
                </p>
            )}

            <section className="routine-list">
                {loading ? (
                    <p className="muted">Loading routines...</p>
                ) : routines.length === 0 ? (
                    <p className="muted">No routines yet. Create your first one above.</p>
                ) : (
                    routines.map((routine) => (
                        <article className="card routine-item" key={routine.id}>
                            <div className="routine-item-head">
                                <div>
                                    <h3>{routine.name}</h3>
                                    <p>{routine.description || 'No description'}</p>
                                </div>
                                <span className={`routine-status ${routine.is_active ? 'active' : 'inactive'}`}>
                                    {routine.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <p className="routine-type">Type: {routine.routine_type}</p>

                            <ul className="routine-template-list">
                                {(routine.tasks || []).map((task) => (
                                    <li key={task.id || `${routine.id}-${task.task_order}`}>
                                        {task.task_template?.title || 'Untitled'}
                                        <span>{task.task_template?.priority || 'medium'}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="routine-item-actions">
                                <button className="btn btn-secondary" type="button" onClick={() => applyRoutine(routine.id)} disabled={isBusy}>
                                    Apply
                                </button>
                                <button className="btn btn-outline" type="button" onClick={() => toggleRoutine(routine.id)} disabled={isBusy}>
                                    {routine.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button className="btn btn-danger" type="button" onClick={() => deleteRoutine(routine.id)} disabled={isBusy}>
                                    Delete
                                </button>
                            </div>
                        </article>
                    ))
                )}
            </section>
        </div>
    );
};

export default Routines;
