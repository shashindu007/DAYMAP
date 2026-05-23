import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../common/Button';
import './ScheduleEditor.css';

const toHm = (value) => (value ? value.slice(0, 5) : '');

const tasksToSlots = (tasks = []) => (
    tasks
        .map((task) => ({
            id: task.id,
            start_time: toHm(task.slot_start_time),
            end_time: toHm(task.slot_end_time),
            title: task.title || '',
            description: task.description || '',
            priority: task.priority || 'medium',
            status: task.status || 'pending'
        }))
        .filter((task) => task.start_time && task.end_time)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
);

const buildDefaultSlot = (start = '09:00', end = '09:30') => ({
    start_time: start,
    end_time: end,
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending'
});

const ScheduleEditor = ({
    date,
    tasks,
    onSave,
    onClose,
    saving,
    allowStatusEdit = true
}) => {
    const [slotValues, setSlotValues] = useState([]);
    const [isDirty, setIsDirty] = useState(false);
    const lastDateRef = useRef(date);

    const resetFromTasks = (taskList) => {
        const nextSlots = tasksToSlots(taskList);
        setSlotValues(nextSlots.length ? nextSlots : [buildDefaultSlot()]);
        setIsDirty(false);
    };

    useEffect(() => {
        if (lastDateRef.current !== date) {
            lastDateRef.current = date;
            resetFromTasks(tasks);
            return;
        }

        if (!isDirty) {
            resetFromTasks(tasks);
        }
    }, [tasks, date, isDirty]);

    const handleSlotChange = (index, field, value) => {
        setSlotValues((prev) => prev.map((slot, slotIndex) => (
            slotIndex === index
                ? { ...slot, [field]: value }
                : slot
        )));
        setIsDirty(true);
    };

    const handleClearSlot = (index) => {
        setSlotValues((prev) => prev.filter((_, slotIndex) => slotIndex !== index));
        setIsDirty(true);
    };

    const handleAddSlot = () => {
        setSlotValues((prev) => {
            if (!prev.length) return [buildDefaultSlot()];
            const last = prev[prev.length - 1];
            const nextStart = last.end_time || '09:00';
            const [hour, minute] = nextStart.split(':').map(Number);
            const total = ((hour || 0) * 60) + (minute || 0) + 30;
            const endHour = `${Math.floor((total % 1440) / 60)}`.padStart(2, '0');
            const endMinute = `${(total % 60)}`.padStart(2, '0');
            const nextEnd = `${endHour}:${endMinute}`;
            return [...prev, buildDefaultSlot(nextStart, nextEnd)];
        });
        setIsDirty(true);
    };

    const buildPayload = () => (
        slotValues
            .map((entry) => {
                if (!entry?.title?.trim()) return null;
                return {
                    title: entry.title.trim(),
                    description: entry.description?.trim() || null,
                    priority: entry.priority || 'medium',
                    status: entry.status || 'pending',
                    start_time: entry.start_time,
                    end_time: entry.end_time
                };
            })
            .filter(Boolean)
    );

    const handleSave = () => {
        const payload = buildPayload();
        onSave(payload);
    };

    const scheduledCount = slotValues.filter((slot) => slot?.title?.trim()).length;

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
                    {slotValues.map((entry, index) => (
                        <div key={`${entry.start_time}-${index}`} className="schedule-slot-row">
                            <div className="schedule-slot-time">
                                <input
                                    type="time"
                                    value={entry.start_time}
                                    onChange={(event) => handleSlotChange(index, 'start_time', event.target.value)}
                                />
                                <span>→</span>
                                <input
                                    type="time"
                                    value={entry.end_time}
                                    onChange={(event) => handleSlotChange(index, 'end_time', event.target.value)}
                                />
                            </div>
                            <div className="schedule-slot-fields">
                                <input
                                    type="text"
                                    value={entry.title || ''}
                                    onChange={(event) => handleSlotChange(index, 'title', event.target.value)}
                                    placeholder="Task title"
                                    maxLength={255}
                                />
                                <input
                                    type="text"
                                    value={entry.description || ''}
                                    onChange={(event) => handleSlotChange(index, 'description', event.target.value)}
                                    placeholder="Notes (optional)"
                                />
                                <select
                                    value={entry.priority || 'medium'}
                                    onChange={(event) => handleSlotChange(index, 'priority', event.target.value)}
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                                {allowStatusEdit && (
                                    <select
                                        value={entry.status || 'pending'}
                                        onChange={(event) => handleSlotChange(index, 'status', event.target.value)}
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
                                onClick={() => handleClearSlot(index)}
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>

                <div className="schedule-editor-actions">
                    {isDirty && (
                        <button
                            type="button"
                            className="schedule-slot-clear"
                            onClick={() => resetFromTasks(tasks)}
                            disabled={saving}
                        >
                            Reset changes
                        </button>
                    )}
                    <Button variant="outline" onClick={handleAddSlot} disabled={saving}>
                        Add slot
                    </Button>
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
