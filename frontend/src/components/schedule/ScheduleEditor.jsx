import React, { useEffect, useMemo, useState } from 'react';
import Button from '../common/Button';
import './ScheduleEditor.css';

const buildSlots = () => {
    const slots = [];
    for (let hour = 0; hour < 24; hour += 1) {
        for (let minute = 0; minute < 60; minute += 30) {
            const startHour = `${hour}`.padStart(2, '0');
            const startMinute = `${minute}`.padStart(2, '0');
            const start = `${startHour}:${startMinute}`;
            const endMinutes = (hour * 60) + minute + 30;
            const normalizedEndMinutes = endMinutes % 1440;
            const endHour = `${Math.floor(normalizedEndMinutes / 60)}`.padStart(2, '0');
            const endMinute = `${normalizedEndMinutes % 60}`.padStart(2, '0');
            const end = `${endHour}:${endMinute}`;
            slots.push({
                start,
                end,
                label: `${start} - ${end}`
            });
        }
    }
    return slots;
};

const tasksToSlotMap = (tasks = []) => {
    const map = {};
    tasks.forEach((task) => {
        const key = task.slot_start_time?.slice(0, 5);
        if (!key) return;
        map[key] = {
            id: task.id,
            title: task.title || '',
            description: task.description || '',
            priority: task.priority || 'medium',
            status: task.status || 'pending'
        };
    });
    return map;
};

const ScheduleEditor = ({
    date,
    tasks,
    onSave,
    onClose,
    saving,
    allowStatusEdit = true
}) => {
    const slots = useMemo(() => buildSlots(), []);
    const [slotValues, setSlotValues] = useState({});

    useEffect(() => {
        setSlotValues(tasksToSlotMap(tasks));
    }, [tasks, date]);

    const handleSlotChange = (slotStart, field, value) => {
        setSlotValues((prev) => ({
            ...prev,
            [slotStart]: {
                ...(prev[slotStart] || { title: '', description: '', priority: 'medium', status: 'pending' }),
                [field]: value
            }
        }));
    };

    const handleClearSlot = (slotStart) => {
        setSlotValues((prev) => {
            const next = { ...prev };
            delete next[slotStart];
            return next;
        });
    };

    const buildPayload = () => (
        slots
            .map((slot) => {
                const entry = slotValues[slot.start];
                if (!entry?.title?.trim()) return null;
                return {
                    title: entry.title.trim(),
                    description: entry.description?.trim() || null,
                    priority: entry.priority || 'medium',
                    status: entry.status || 'pending',
                    start_time: slot.start,
                    end_time: slot.end
                };
            })
            .filter(Boolean)
    );

    const handleSave = () => {
        const payload = buildPayload();
        onSave(payload);
    };

    const scheduledCount = Object.values(slotValues).filter((slot) => slot?.title?.trim()).length;

    return (
        <div className="schedule-editor-overlay" onClick={onClose}>
            <div className="schedule-editor" onClick={(event) => event.stopPropagation()}>
                <div className="schedule-editor-header">
                    <div>
                        <h2>Schedule for {date}</h2>
                        <p className="muted">Fill each 30-minute slot with a task or leave it blank.</p>
                    </div>
                    <div className="schedule-editor-summary">
                        <span>{scheduledCount} slots planned</span>
                    </div>
                </div>

                <div className="schedule-editor-list">
                    {slots.map((slot) => {
                        const entry = slotValues[slot.start] || {};
                        return (
                            <div key={slot.start} className="schedule-slot-row">
                                <div className="schedule-slot-time">{slot.label}</div>
                                <div className="schedule-slot-fields">
                                    <input
                                        type="text"
                                        value={entry.title || ''}
                                        onChange={(event) => handleSlotChange(slot.start, 'title', event.target.value)}
                                        placeholder="Task title"
                                        maxLength={255}
                                    />
                                    <input
                                        type="text"
                                        value={entry.description || ''}
                                        onChange={(event) => handleSlotChange(slot.start, 'description', event.target.value)}
                                        placeholder="Notes (optional)"
                                    />
                                    <select
                                        value={entry.priority || 'medium'}
                                        onChange={(event) => handleSlotChange(slot.start, 'priority', event.target.value)}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                    {allowStatusEdit && (
                                        <select
                                            value={entry.status || 'pending'}
                                            onChange={(event) => handleSlotChange(slot.start, 'status', event.target.value)}
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    className="schedule-slot-clear"
                                    onClick={() => handleClearSlot(slot.start)}
                                >
                                    Clear
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="schedule-editor-actions">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        Close
                    </Button>
                    <Button variant="primary" onClick={handleSave} loading={saving}>
                        Save Schedule
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ScheduleEditor;
