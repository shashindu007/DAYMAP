const { v4: uuidv4 } = require('uuid');
const Schedule = require('../models/Schedule');
const ScheduleTask = require('../models/ScheduleTask');

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

const validateSlotTimes = (startTime, endTime) => {
    const startMinutes = toMinutes(startTime);
    const endMinutes = toMinutes(endTime);
    const adjustedEndMinutes = (endMinutes === 0 && startMinutes === 1410)
        ? 1440
        : endMinutes;

    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
        return { valid: false, message: 'Invalid slot start or end time.' };
    }

    if (adjustedEndMinutes - startMinutes !== 30) {
        return { valid: false, message: 'Each slot must be exactly 30 minutes.' };
    }

    if (startMinutes < 0 || adjustedEndMinutes > 1440) {
        return { valid: false, message: 'Slot time must be within a single day.' };
    }

    return { valid: true };
};

const normalizeSlots = (slots) => {
    const seen = new Set();
    const normalized = [];

    for (const slot of slots) {
        const normalizedStart = normalizeTimeToSeconds(slot.start_time);
        const normalizedEnd = normalizeTimeToSeconds(slot.end_time);

        if (!normalizedStart || !normalizedEnd) {
            throw new Error('Slot start and end times must be in HH:MM or HH:MM:SS format.');
        }

        const { valid, message } = validateSlotTimes(normalizedStart, normalizedEnd);
        if (!valid) {
            throw new Error(message);
        }

        if (seen.has(normalizedStart)) {
            throw new Error('Duplicate slot start times are not allowed.');
        }

        seen.add(normalizedStart);

        normalized.push({
            ...slot,
            start_time: normalizedStart,
            end_time: normalizedEnd
        });
    }

    return normalized;
};

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
        duration_minutes: 30
    }));

    const tasks = await ScheduleTask.createMany(tasksToCreate);

    return {
        schedule,
        tasks
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
        duration_minutes: 30
    }));

    const tasks = await ScheduleTask.createMany(tasksToCreate);

    return {
        schedule,
        tasks
    };
};

const updateScheduleTask = async (userId, taskId, updates) => {
    const existing = await ScheduleTask.findById(taskId);
    if (!existing || existing.user_id !== userId) return null;
    return ScheduleTask.update(taskId, updates);
};

const updateScheduleTaskStatus = async (userId, taskId, status) => {
    const existing = await ScheduleTask.findById(taskId);
    if (!existing || existing.user_id !== userId) return null;
    return ScheduleTask.updateStatus(taskId, status);
};

const deleteScheduleTask = async (userId, taskId) => {
    const existing = await ScheduleTask.findById(taskId);
    if (!existing || existing.user_id !== userId) return null;
    await ScheduleTask.deleteById(taskId);
    return existing;
};

const deleteScheduleByDate = async (userId, date) => {
    await ScheduleTask.deleteByUserAndDate(userId, date);
    await Schedule.deleteByUserAndDate(userId, date);
};

const getScheduleRange = async (userId, startDate, endDate) => {
    const tasks = await ScheduleTask.findByDateRange(userId, startDate, endDate);
    return tasks;
};

module.exports = {
    getScheduleByDate,
    createOrReplaceSchedule,
    replaceScheduleForDate,
    updateScheduleTask,
    updateScheduleTaskStatus,
    deleteScheduleTask,
    deleteScheduleByDate,
    getScheduleRange
};
