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

const formatHm = (minutes) => {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const hours = `${Math.floor(normalized / 60)}`.padStart(2, '0');
    const mins = `${normalized % 60}`.padStart(2, '0');
    return `${hours}:${mins}`;
};

const roundToNextSlot = (minutes, increment = 30) => (
    Math.ceil(minutes / increment) * increment
);

const timeToMinutes = (value) => {
    if (!value) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return (hours * 60) + minutes;
};

const getNowRoundedTime = () => {
    const now = new Date();
    const nowMinutes = (now.getHours() * 60) + now.getMinutes();
    return formatHm(roundToNextSlot(nowMinutes));
};

const getSlotTimeError = (slot) => {
    const startMinutes = timeToMinutes(slot?.start_time);
    const endMinutes = timeToMinutes(slot?.end_time);
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
        return 'Start and end time are required.';
    }
    if (endMinutes <= startMinutes) {
        return 'End time must be after start time (same-day only).';
    }
    return '';
};

const getDefaultStartTime = (date, hasExistingSlots) => {
    if (hasExistingSlots) return null;
    const today = new Date();
    const todayYmd = today.toISOString().split('T')[0];
    if (date === todayYmd) {
        const nowMinutes = (today.getHours() * 60) + today.getMinutes();
        return formatHm(roundToNextSlot(nowMinutes));
    }
    return '00:00';
};

const buildDefaultSlot = (start = '09:00', durationMinutes = 30) => {
    const [hour, minute] = start.split(':').map(Number);
    const startMinutes = ((hour || 0) * 60) + (minute || 0);
    const endMinutes = startMinutes + durationMinutes;
    const end = formatHm(endMinutes);
    return {
        start_time: start,
        end_time: end,
        title: '',
        description: '',
        priority: 'medium',
        status: 'pending'
    };
};

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
        if (nextSlots.length) {
            setSlotValues(nextSlots);
        } else {
            const isToday = date === new Date().toISOString().split('T')[0];
            const start = (isToday ? getNowRoundedTime() : getDefaultStartTime(date, false)) || '09:00';
            setSlotValues([buildDefaultSlot(start)]);
        }
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
            const isToday = date === new Date().toISOString().split('T')[0];
            const nowStart = isToday ? getNowRoundedTime() : null;
            if (!prev.length) {
                const start = (nowStart || getDefaultStartTime(date, false)) || '09:00';
                return [buildDefaultSlot(start)];
            }
            const last = prev[prev.length - 1];
            let nextStart = last.end_time || getDefaultStartTime(date, true) || '09:00';
            if (isToday && nowStart) {
                const lastEndMinutes = timeToMinutes(last.end_time);
                const nowMinutes = timeToMinutes(nowStart);
                if (Number.isFinite(lastEndMinutes) && Number.isFinite(nowMinutes)) {
                    nextStart = lastEndMinutes > nowMinutes ? last.end_time : nowStart;
                } else if (Number.isFinite(nowMinutes)) {
                    nextStart = nowStart;
                }
            }
            return [...prev, buildDefaultSlot(nextStart)];
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

    const slotErrors = useMemo(
        () => slotValues.map((slot) => getSlotTimeError(slot)),
        [slotValues]
    );

    const hasValidationErrors = slotErrors.some(Boolean);

    const scheduledCount = slotValues.filter((slot) => slot?.title?.trim()).length;

    return (
        <div className="schedule-editor-overlay" onClick={onClose}>
            <div className="schedule-editor" onClick={(event) => event.stopPropagation()}>
                <div className="schedule-editor-header">
                    <div>
                        <h2>Schedule for {date}</h2>
                        <p className="muted">Add tasks and adjust slot times as needed.</p>
                    </div>
                    <div className="schedule-editor-summary">
                        <span>{scheduledCount} slots planned</span>
                    </div>
                </div>

                <div className="schedule-editor-list">
                    {slotValues.map((entry, index) => (
                        <div
                            key={`${entry.start_time}-${index}`}
                            className={`schedule-slot-row ${slotErrors[index] ? 'has-error' : ''}`}
                        >
                            <div className="schedule-slot-time">
                                <input
                                    type="time"
                                    value={entry.start_time}
                                    lang="en-GB"
                                    step="60"
                                    onChange={(event) => handleSlotChange(index, 'start_time', event.target.value)}
                                />
                                <span>→</span>
                                <input
                                    type="time"
                                    value={entry.end_time}
                                    lang="en-GB"
                                    step="60"
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
                            {slotErrors[index] && (
                                <div className="schedule-slot-error">{slotErrors[index]}</div>
                            )}
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
                    <Button variant="primary" onClick={handleSave} loading={saving} disabled={hasValidationErrors}>
                        Save Schedule
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ScheduleEditor;
