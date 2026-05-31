const { v4: uuidv4 } = require('uuid');
const Schedule = require('../models/Schedule');
const ScheduleTask = require('../models/ScheduleTask');
const Task = require('../models/Task');
const Analytics = require('../models/Analytics');

const normalizeTimeToSeconds = (value) => {
    if (!value || typeof value !== 'string') return null;
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
        return `${value}:00`;
    }
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) {
        return value;
    }
    return null;
};

const toMinutes = (value) => {
    if (!value) return null;
    const parts = value.split(':').map(Number);
    if (parts.length < 2) return null;
    const [hours, minutes] = parts;
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return (hours * 60) + minutes;
};

const resolveEndMinutes = (startMinutes, endMinutes) => {
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return null;
    if (endMinutes === 0 && startMinutes > 0) return 1440;
    return endMinutes;
};

const validateSlotTimes = (startTime, endTime) => {
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    const adjustedEndMinutes = resolveEndMinutes(startMinutes, endMinutes);

    if (!Number.isFinite(startMinutes) || !Number.isFinite(adjustedEndMinutes)) {
        return { valid: false, message: 'Invalid slot start or end time.' };
    }

    if (startMinutes < 0 || adjustedEndMinutes > 1440) {
        return { valid: false, message: 'Slot time must be within a single day.' };
    }

    if (adjustedEndMinutes <= startMinutes) {
        return { valid: false, message: 'Slot end time must be after the start time.' };
    }

    return { valid: true, startMinutes, endMinutes: adjustedEndMinutes };
};

const normalizeSlots = (slots) => {
    const normalized = [];

    for (const slot of slots) {
        const normalizedStart = normalizeTimeToSeconds(slot.start_time);
        const normalizedEnd = normalizeTimeToSeconds(slot.end_time);

        if (!normalizedStart || !normalizedEnd) {
            throw new Error('Slot start and end times must be in HH:MM or HH:MM:SS format.');
        }

        const { valid, message, startMinutes, endMinutes } = validateSlotTimes(normalizedStart, normalizedEnd);
        if (!valid) {
            throw new Error(message);
        }

        normalized.push({
            ...slot,
            start_time: normalizedStart,
            end_time: normalizedEnd,
            startMinutes,
            endMinutes,
            duration_minutes: endMinutes - startMinutes
        });
    }

    const sorted = normalized.slice().sort((a, b) => a.startMinutes - b.startMinutes);
    for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const next = sorted[i];
        if (next.startMinutes < prev.endMinutes) {
            throw new Error('Schedule slots cannot overlap.');
        }
    }

    return normalized;
};

const buildExistingRanges = (tasks) => tasks
    .map((task) => {
        const startMinutes = toMinutes(task.slot_start_time);
        const endMinutes = resolveEndMinutes(startMinutes, toMinutes(task.slot_end_time));
        if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return null;
        return { startMinutes, endMinutes };
    })
    .filter(Boolean);

const getOrCreateSchedule = async (userId, date) => {
    const existing = await Schedule.findByUserAndDate(userId, date);
    if (existing) return existing;
    return Schedule.create({ user_id: userId, scheduled_date: date });
};

const getScheduleByDate = async (userId, date) => {
    const schedule = await Schedule.findByUserAndDate(userId, date);
    const tasks = await ScheduleTask.findByDate(userId, date);

    return {
        schedule,
        tasks
    };
};

const updateAnalyticsForDate = async (userId, date) => {
    try {
        const [scheduleStats, taskStats] = await Promise.all([
            ScheduleTask.getStatsByDate(userId, date),
            Task.getStatsByDate(userId, date)
        ]);

        const combined = {
            total_tasks_scheduled: (parseInt(scheduleStats.total_tasks, 10) || 0) + (parseInt(taskStats.total_tasks, 10) || 0),
            total_tasks_completed: (parseInt(scheduleStats.completed_tasks, 10) || 0) + (parseInt(taskStats.completed_tasks, 10) || 0),
            total_time_scheduled_minutes: (parseInt(scheduleStats.total_scheduled_minutes, 10) || 0) + (parseInt(taskStats.total_scheduled_minutes, 10) || 0),
            total_time_spent_minutes: (parseInt(scheduleStats.total_actual_minutes, 10) || 0) + (parseInt(taskStats.total_actual_minutes, 10) || 0)
        };

        await Analytics.upsert(userId, date, combined);
    } catch (error) {
        console.warn('Schedule analytics update failed:', error?.message || error);
    }
};

const createOrReplaceSchedule = async (userId, date, slots, replaceExisting) => {
    const schedule = await getOrCreateSchedule(userId, date);

    if (replaceExisting) {
        await ScheduleTask.deleteByScheduleId(schedule.id);
    }

    const normalizedSlots = normalizeSlots(slots);
    const tasksToCreate = normalizedSlots.map((slot) => ({
        id: uuidv4(),
        schedule_id: schedule.id,
        user_id: userId,
        scheduled_date: date,
        slot_start_time: slot.start_time,
        slot_end_time: slot.end_time,
        title: slot.title,
        description: slot.description || null,
        category: slot.category || null,
        priority: slot.priority || 'medium',
        status: slot.status || 'pending',
        duration_minutes: slot.duration_minutes
    }));

    const tasks = await ScheduleTask.createMany(tasksToCreate);

    await updateAnalyticsForDate(userId, date);

    return {
        schedule,
        tasks
    };
};

const addSlotsToSchedule = async (userId, date, slots) => {
    const schedule = await getOrCreateSchedule(userId, date);
    const existingTasks = await ScheduleTask.findByDate(userId, date);
    const existingStartTimes = new Set(existingTasks.map((task) => task.slot_start_time));
    const existingRanges = buildExistingRanges(existingTasks);

    const deduped = [];
    const seenStartTimes = new Set();
    for (const slot of slots) {
        if (seenStartTimes.has(slot.start_time)) continue;
        seenStartTimes.add(slot.start_time);
        deduped.push(slot);
    }

    const candidates = deduped.filter((slot) => !existingStartTimes.has(slot.start_time));
    if (!candidates.length) {
        return {
            schedule,
            tasks: [],
            skipped: slots.length
        };
    }

    const normalizedSlots = normalizeSlots(candidates);
    const nonOverlapping = normalizedSlots.filter((slot) => (
        existingRanges.every((range) => slot.startMinutes >= range.endMinutes || slot.endMinutes <= range.startMinutes)
    ));

    if (!nonOverlapping.length) {
        return {
            schedule,
            tasks: [],
            skipped: slots.length
        };
    }

    const tasksToCreate = nonOverlapping.map((slot) => ({
        id: uuidv4(),
        schedule_id: schedule.id,
        user_id: userId,
        scheduled_date: date,
        slot_start_time: slot.start_time,
        slot_end_time: slot.end_time,
        title: slot.title,
        description: slot.description || null,
        category: slot.category || null,
        priority: slot.priority || 'medium',
        status: slot.status || 'pending',
        duration_minutes: slot.duration_minutes
    }));

    const tasks = await ScheduleTask.createMany(tasksToCreate);

    await updateAnalyticsForDate(userId, date);

    return {
        schedule,
        tasks,
        skipped: slots.length - nonOverlapping.length
    };
};

const replaceScheduleForDate = async (userId, date, slots) => {
    const schedule = await getOrCreateSchedule(userId, date);
    await ScheduleTask.deleteByScheduleId(schedule.id);
    const normalizedSlots = normalizeSlots(slots);
    const tasksToCreate = normalizedSlots.map((slot) => ({
        id: uuidv4(),
        schedule_id: schedule.id,
        user_id: userId,
        scheduled_date: date,
        slot_start_time: slot.start_time,
        slot_end_time: slot.end_time,
        title: slot.title,
        description: slot.description || null,
        category: slot.category || null,
        priority: slot.priority || 'medium',
        status: slot.status || 'pending',
        duration_minutes: slot.duration_minutes
    }));

    const tasks = await ScheduleTask.createMany(tasksToCreate);

    await updateAnalyticsForDate(userId, date);

    return {
        schedule,
        tasks
    };
};

const updateScheduleTask = async (userId, taskId, updates) => {
    const existing = await ScheduleTask.findById(taskId);
    if (!existing || existing.user_id !== userId) return null;
    const updated = await ScheduleTask.update(taskId, updates);
    await updateAnalyticsForDate(userId, existing.scheduled_date);
    return updated;
};

const updateScheduleTaskStatus = async (userId, taskId, status) => {
    const existing = await ScheduleTask.findById(taskId);
    if (!existing || existing.user_id !== userId) return null;
    const updated = await ScheduleTask.updateStatus(taskId, status);
    await updateAnalyticsForDate(userId, existing.scheduled_date);
    return updated;
};

const deleteScheduleTask = async (userId, taskId) => {
    const existing = await ScheduleTask.findById(taskId);
    if (!existing || existing.user_id !== userId) return null;
    await ScheduleTask.deleteById(taskId);
    await updateAnalyticsForDate(userId, existing.scheduled_date);
    return existing;
};

const deleteScheduleByDate = async (userId, date) => {
    await ScheduleTask.deleteByUserAndDate(userId, date);
    await Schedule.deleteByUserAndDate(userId, date);
    await updateAnalyticsForDate(userId, date);
};

const getScheduleRange = async (userId, startDate, endDate) => {
    const tasks = await ScheduleTask.findByDateRange(userId, startDate, endDate);
    return tasks;
};

module.exports = {
    getScheduleByDate,
    createOrReplaceSchedule,
    addSlotsToSchedule,
    replaceScheduleForDate,
    updateScheduleTask,
    updateScheduleTaskStatus,
    deleteScheduleTask,
    deleteScheduleByDate,
    getScheduleRange
};
