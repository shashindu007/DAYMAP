import React, { useEffect, useMemo, useState } from 'react';
import { useRoutine } from '../context/RoutineContext';
import './Routines.css';

const DEFAULT_ITEM = { title: '', notes: '', duration_minutes: '', start_time: '', end_time: '' };

const dayOptions = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 }
];

const Routines = () => {
    const {
        templates,
        loading,
        error,
        fetchTemplates,
        createTemplate,
        updateTemplate,
        deleteTemplate
    } = useRoutine();

    const [form, setForm] = useState({
        name: '',
        description: '',
        color: '#6366F1',
        icon: '',
        is_active: true,
        recurrence: { type: 'daily', days_of_week: [] },
        items: [{ ...DEFAULT_ITEM }]
    });

    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState('');

    useEffect(() => {
        fetchTemplates().catch(() => null);
    }, [fetchTemplates]);

    const resetForm = () => {
        setForm({
            name: '',
            description: '',
            color: '#6366F1',
            icon: '',
            is_active: true,
            recurrence: { type: 'daily', days_of_week: [] },
            items: [{ ...DEFAULT_ITEM }]
        });
        setEditingId(null);
    };

    const handleField = (event) => {
        const { name, value, type, checked } = event.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleRecurrenceType = (event) => {
        const type = event.target.value;
        setForm((prev) => ({
            ...prev,
            recurrence: {
                ...prev.recurrence,
                type,
                days_of_week: type === 'custom' ? prev.recurrence.days_of_week : []
            }
        }));
    };

    const toggleDay = (day) => {
        setForm((prev) => {
            const exists = prev.recurrence.days_of_week.includes(day);
            const nextDays = exists
                ? prev.recurrence.days_of_week.filter((value) => value !== day)
                : [...prev.recurrence.days_of_week, day];
            return {
                ...prev,
                recurrence: {
                    ...prev.recurrence,
                    days_of_week: nextDays
                }
            };
        });
    };

    const handleItemChange = (index, field, value) => {
        setForm((prev) => {
            const items = [...prev.items];
            items[index] = { ...items[index], [field]: value };
            return { ...prev, items };
        });
    };

    const addItem = () => {
        setForm((prev) => ({
            ...prev,
            items: [...prev.items, { ...DEFAULT_ITEM }]
        }));
    };

    const removeItem = (index) => {
        setForm((prev) => ({
            ...prev,
            items: prev.items.filter((_, itemIndex) => itemIndex !== index)
        }));
    };

    const startEdit = (routine) => {
        setEditingId(routine.id);
        setForm({
            name: routine.name,
            description: routine.description || '',
            color: routine.color || '#6366F1',
            icon: routine.icon || '',
            is_active: routine.is_active !== false,
            recurrence: routine.recurrence || { type: 'daily', days_of_week: [] },
            items: (routine.items || []).map((item) => ({
                title: item.title,
                notes: item.notes || '',
                duration_minutes: item.duration_minutes || '',
                start_time: item.start_time || '',
                end_time: item.end_time || ''
            }))
        });
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this routine template?')) return;
        await deleteTemplate(id);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLocalError('');

        if (!form.name.trim()) {
            setLocalError('Routine name is required.');
            return;
        }

        const cleanedItems = form.items
            .filter((item) => item.title.trim())
            .map((item, index) => ({
                title: item.title.trim(),
                notes: item.notes.trim() || null,
                duration_minutes: item.duration_minutes ? parseInt(item.duration_minutes, 10) : null,
                start_time: item.start_time || null,
                end_time: item.end_time || null,
                order: index
            }));

        if (cleanedItems.length === 0) {
            setLocalError('Add at least one routine item.');
            return;
        }

        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            color: form.color || '#6366F1',
            icon: form.icon || null,
            is_active: form.is_active,
            recurrence: form.recurrence,
            items: cleanedItems
        };

        try {
            setSaving(true);
            if (editingId) {
                await updateTemplate(editingId, payload);
            } else {
                await createTemplate(payload);
            }
            resetForm();
            await fetchTemplates();
        } catch (err) {
            setLocalError(err?.message || 'Failed to save routine.');
        } finally {
            setSaving(false);
        }
    };

    const activeCount = useMemo(() => templates.filter((item) => item.is_active).length, [templates]);

    return (
        <div className="routines-page">
            <div className="routines-header">
                <h1>Routines</h1>
                <p>Create reusable routine templates that power your daily schedule.</p>
            </div>

            <div className="routines-meta card">
                <p><strong>{templates.length}</strong> routines • <strong>{activeCount}</strong> active</p>
            </div>

            <form className="card routine-form" onSubmit={handleSubmit} aria-busy={saving}>
                <h2>{editingId ? 'Edit Routine Template' : 'Create Routine Template'}</h2>
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
                <div className="routine-form-row">
                    <input
                        className="input"
                        type="color"
                        name="color"
                        value={form.color}
                        onChange={handleField}
                    />
                    <input
                        className="input"
                        name="icon"
                        value={form.icon}
                        onChange={handleField}
                        placeholder="Icon (emoji or text)"
                        maxLength={20}
                    />
                    <label className="routine-toggle">
                        <input
                            type="checkbox"
                            name="is_active"
                            checked={form.is_active}
                            onChange={handleField}
                        />
                        Active
                    </label>
                </div>

                <div className="routine-form-row">
                    <label>
                        Recurrence
                        <select className="input" value={form.recurrence.type} onChange={handleRecurrenceType}>
                            <option value="daily">Every day</option>
                            <option value="weekdays">Weekdays</option>
                            <option value="weekends">Weekends</option>
                            <option value="custom">Custom days</option>
                        </select>
                    </label>
                    {form.recurrence.type === 'custom' && (
                        <div className="routine-days">
                            {dayOptions.map((day) => (
                                <button
                                    type="button"
                                    key={day.value}
                                    className={`routine-day ${form.recurrence.days_of_week.includes(day.value) ? 'active' : ''}`}
                                    onClick={() => toggleDay(day.value)}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <h3>Routine Items</h3>
                {form.items.map((item, idx) => (
                    <div className="routine-task-row" key={`template-item-${idx}`}>
                        <input
                            className="input"
                            placeholder="Item title"
                            value={item.title}
                            onChange={(e) => handleItemChange(idx, 'title', e.target.value)}
                            maxLength={255}
                        />
                        <input
                            className="input"
                            placeholder="Notes"
                            value={item.notes}
                            onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                        />
                        <input
                            className="input"
                            type="time"
                            value={item.start_time}
                            onChange={(e) => handleItemChange(idx, 'start_time', e.target.value)}
                        />
                        <input
                            className="input"
                            type="time"
                            value={item.end_time}
                            onChange={(e) => handleItemChange(idx, 'end_time', e.target.value)}
                        />
                        <input
                            className="input"
                            type="number"
                            min="1"
                            max="1440"
                            placeholder="Duration"
                            value={item.duration_minutes}
                            onChange={(e) => handleItemChange(idx, 'duration_minutes', e.target.value)}
                        />
                        <button className="btn btn-outline" type="button" onClick={() => removeItem(idx)}>
                            Remove
                        </button>
                    </div>
                ))}

                <div className="routine-form-actions">
                    <button className="btn btn-secondary" type="button" onClick={addItem} disabled={saving}>
                        Add Item
                    </button>
                    <button className="btn btn-primary" type="submit" disabled={saving}>
                        {saving ? 'Saving...' : (editingId ? 'Update Routine' : 'Create Routine')}
                    </button>
                    {editingId && (
                        <button className="btn btn-outline" type="button" onClick={resetForm} disabled={saving}>
                            Cancel
                        </button>
                    )}
                </div>
            </form>

            {(localError || error) && (
                <p className="dashboard-error" role="alert" aria-live="polite">
                    {localError || error}
                </p>
            )}

            <section className="routine-list">
                {loading ? (
                    <p className="muted">Loading routines...</p>
                ) : templates.length === 0 ? (
                    <p className="muted">No routines yet. Create your first template above.</p>
                ) : (
                    templates.map((routine) => (
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
                            <p className="routine-type">Recurrence: {routine.recurrence?.type || 'daily'}</p>

                            <ul className="routine-template-list">
                                {(routine.items || []).map((item) => (
                                    <li key={item.id}>
                                        {item.title}
                                        <span>{item.duration_minutes ? `${item.duration_minutes} min` : 'Flexible'}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="routine-item-actions">
                                <button className="btn btn-secondary" type="button" onClick={() => startEdit(routine)}>
                                    Edit
                                </button>
                                <button
                                    className="btn btn-outline"
                                    type="button"
                                    onClick={() => updateTemplate(routine.id, { is_active: !routine.is_active })}
                                >
                                    {routine.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button className="btn btn-outline" type="button" onClick={() => handleDelete(routine.id)}>
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
