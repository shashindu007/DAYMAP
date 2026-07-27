import React, { useEffect, useMemo, useState } from 'react';
import { useRoutine } from '../context/RoutineContext';
import ConfirmDialog from '../components/common/ConfirmDialog';
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

const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];

/**
 * Which weekdays a routine actually runs on. The list used to print a raw
 * lowercase enum ("Recurrence: daily") and custom day selections were invisible
 * — you had to open the editor to find out which days a routine ran.
 */
const activeDaysFor = (recurrence) => {
    switch (recurrence?.type) {
        case 'weekdays': return WEEKDAYS;
        case 'weekends': return WEEKENDS;
        case 'custom': return recurrence.days_of_week || [];
        default: return [0, 1, 2, 3, 4, 5, 6];
    }
};

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
    // The builder used to be permanently expanded above the list, so reading
    // your routines meant scrolling past the entire creation form every visit.
    const [builderOpen, setBuilderOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState('');
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

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
        setBuilderOpen(false);
    };

    const startCreate = () => {
        resetForm();
        setBuilderOpen(true);
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
        // Without this, Edit populated a form far off-screen and the visible
        // page did not change at all — the button looked broken.
        setBuilderOpen(true);
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

    const handleConfirmDelete = async () => {
        if (!pendingDelete) return;
        try {
            setDeleting(true);
            await deleteTemplate(pendingDelete.id);
            setPendingDelete(null);
        } catch (err) {
            setLocalError(err?.message || 'Failed to delete routine.');
        } finally {
            setDeleting(false);
        }
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

    /* Deactivated routines used to interleave with active ones at full weight. */
    const sortedTemplates = useMemo(() => (
        [...templates].sort((a, b) => Number(b.is_active !== false) - Number(a.is_active !== false))
    ), [templates]);

    return (
        <div className="routines-page">
            {/* The "N routines • M active" line used to occupy a whole card of
                its own, complete with shadow and hover lift. */}
            <div className="routines-header">
                <div>
                    <h1>Routines</h1>
                    <p>{templates.length} routine{templates.length === 1 ? '' : 's'} · {activeCount} active</p>
                </div>
                <button className="btn btn-primary" type="button" onClick={startCreate}>
                    New routine
                </button>
            </div>

            {builderOpen && (
            <form className="card routine-form" onSubmit={handleSubmit} aria-busy={saving}>
                <h2>{editingId ? 'Edit routine' : 'New routine'}</h2>
                <label className="routine-field">
                    <span>Name</span>
                    <input
                        className="input"
                        name="name"
                        value={form.name}
                        onChange={handleField}
                        placeholder="e.g. Morning routine"
                        maxLength={100}
                        required
                    />
                </label>
                <label className="routine-field">
                    <span>Description <em>optional</em></span>
                    <textarea
                        className="input"
                        name="description"
                        value={form.description}
                        onChange={handleField}
                        rows={2}
                    />
                </label>
                <div className="routine-form-row">
                    <label className="routine-field routine-field--color">
                        <span>Colour</span>
                        <input
                            className="input"
                            type="color"
                            name="color"
                            value={form.color}
                            onChange={handleField}
                        />
                    </label>
                    <label className="routine-field">
                        <span>Icon <em>optional</em></span>
                        <input
                            className="input"
                            name="icon"
                            value={form.icon}
                            onChange={handleField}
                            placeholder="🌅"
                            maxLength={20}
                        />
                    </label>
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

                <h3>Routine items</h3>
                {/* Every control is labelled. These were six bare inputs with
                    only placeholders, and the two type="time" fields had none
                    at all — you could not tell start from end without clicking. */}
                {form.items.map((item, idx) => (
                    <div className="routine-task-row" key={`template-item-${idx}`}>
                        <label className="routine-field">
                            <span>Title</span>
                            <input
                                className="input"
                                value={item.title}
                                onChange={(e) => handleItemChange(idx, 'title', e.target.value)}
                                maxLength={255}
                            />
                        </label>
                        <label className="routine-field">
                            <span>Notes</span>
                            <input
                                className="input"
                                value={item.notes}
                                onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                            />
                        </label>
                        <label className="routine-field">
                            <span>Start</span>
                            <input
                                className="input"
                                type="time"
                                value={item.start_time}
                                onChange={(e) => handleItemChange(idx, 'start_time', e.target.value)}
                            />
                        </label>
                        <label className="routine-field">
                            <span>End</span>
                            <input
                                className="input"
                                type="time"
                                value={item.end_time}
                                onChange={(e) => handleItemChange(idx, 'end_time', e.target.value)}
                            />
                        </label>
                        <label className="routine-field">
                            <span>Minutes</span>
                            <input
                                className="input"
                                type="number"
                                min="1"
                                max="1440"
                                value={item.duration_minutes}
                                onChange={(e) => handleItemChange(idx, 'duration_minutes', e.target.value)}
                            />
                        </label>
                        <button
                            className="btn btn-sm btn-danger-quiet routine-item-remove"
                            type="button"
                            onClick={() => removeItem(idx)}
                            aria-label={`Remove item ${idx + 1}`}
                        >
                            Remove
                        </button>
                    </div>
                ))}

                <div className="routine-form-actions">
                    <button className="btn btn-outline" type="button" onClick={addItem} disabled={saving}>
                        Add item
                    </button>
                    <div className="routine-form-submit">
                        <button className="btn btn-outline" type="button" onClick={resetForm} disabled={saving}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" type="submit" disabled={saving}>
                            {saving ? 'Saving...' : (editingId ? 'Update routine' : 'Create routine')}
                        </button>
                    </div>
                </div>
            </form>
            )}

            {(localError || error) && (
                <p className="alert alert-error" role="alert" aria-live="polite">
                    {localError || error}
                </p>
            )}

            <section className="routine-list">
                {loading ? (
                    <p className="muted">Loading routines...</p>
                ) : templates.length === 0 ? (
                    <div className="empty-state">
                        <p>No routines yet.</p>
                        <button className="btn btn-primary" type="button" onClick={startCreate}>
                            Create your first routine
                        </button>
                    </div>
                ) : (
                    sortedTemplates.map((routine) => {
                        const activeDays = activeDaysFor(routine.recurrence);
                        return (
                            <article
                                className={`card routine-item ${routine.is_active ? '' : 'routine-item--inactive'}`}
                                key={routine.id}
                                /* The colour picked in the builder was stored
                                   and then never shown anywhere. */
                                style={{ '--routine-color': routine.color || 'var(--primary)' }}
                            >
                                <div className="routine-item-head">
                                    <div className="routine-item-title">
                                        {routine.icon && (
                                            <span className="routine-icon" aria-hidden>{routine.icon}</span>
                                        )}
                                        <div>
                                            <h3>{routine.name}</h3>
                                            {routine.description && <p>{routine.description}</p>}
                                        </div>
                                    </div>
                                    <span className={`routine-status ${routine.is_active ? 'active' : 'inactive'}`}>
                                        {routine.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>

                                <div className="routine-day-chips" aria-label="Runs on">
                                    {dayOptions.map((day) => (
                                        <span
                                            key={day.value}
                                            className={`routine-day-chip ${activeDays.includes(day.value) ? 'is-on' : ''}`}
                                        >
                                            {day.label}
                                        </span>
                                    ))}
                                </div>

                                <ul className="routine-template-list">
                                    {(routine.items || []).map((item) => (
                                        <li key={item.id}>
                                            {item.title}
                                            <span>{item.duration_minutes ? `${item.duration_minutes} min` : 'Flexible'}</span>
                                        </li>
                                    ))}
                                </ul>

                                <div className="routine-item-actions">
                                    <button className="btn btn-sm btn-outline" type="button" onClick={() => startEdit(routine)}>
                                        Edit
                                    </button>
                                    <button
                                        className="btn btn-sm btn-ghost"
                                        type="button"
                                        onClick={() => updateTemplate(routine.id, { is_active: !routine.is_active })}
                                    >
                                        {routine.is_active ? 'Deactivate' : 'Activate'}
                                    </button>
                                    {/* Delete used to be styled identically to
                                        Deactivate right next to it. */}
                                    <button
                                        className="btn btn-sm btn-danger-quiet"
                                        type="button"
                                        onClick={() => setPendingDelete(routine)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </article>
                        );
                    })
                )}
            </section>

            {pendingDelete && (
                <ConfirmDialog
                    title="Delete this routine?"
                    description={`"${pendingDelete.name}" and its scheduled items will be removed. This can’t be undone.`}
                    busy={deleting}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setPendingDelete(null)}
                />
            )}
        </div>
    );
};

export default Routines;
