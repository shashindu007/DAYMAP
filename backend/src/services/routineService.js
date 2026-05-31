const Routine = require('../models/Routine');
const RoutineTask = require('../models/RoutineTask');
const RoutineTemplate = require('../models/RoutineTemplate');
const RoutineInstance = require('../models/RoutineInstance');
const RoutineAnalytics = require('../models/RoutineAnalytics');

const DEFAULT_DAY_START = '06:00';

const normalizeTimeToSeconds = (value) => {
    if (!value || typeof value !== 'string') return null;
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return `${value}:00`;
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(value)) return value;
    return null;
};

const timeToMinutes = (value) => {
    if (!value) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return (hours * 60) + minutes;
};

const minutesToTime = (minutes) => {
    if (!Number.isFinite(minutes)) return null;
    if (minutes < 0 || minutes >= 1440) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const normalizeRecurrence = (recurrence = {}) => {
    const type = recurrence.type || 'daily';
    const days_of_week = Array.isArray(recurrence.days_of_week)
        ? recurrence.days_of_week.map((day) => parseInt(day, 10)).filter((day) => Number.isFinite(day))
        : null;

    return {
        type,
        days_of_week: days_of_week && days_of_week.length ? days_of_week : null,
        start_date: recurrence.start_date || null,
        end_date: recurrence.end_date || null
    };
};

const isWithinDateRange = (date, startDate, endDate) => {
    if (startDate && date < startDate) return false;
    if (endDate && date > endDate) return false;
    return true;
};

const matchesRecurrence = (recurrence, date) => {
    const normalized = normalizeRecurrence(recurrence);
    if (!isWithinDateRange(date, normalized.start_date, normalized.end_date)) return false;

    const dayIndex = new Date(`${date}T00:00:00`).getDay();
    switch (normalized.type) {
        case 'weekdays':
            return dayIndex >= 1 && dayIndex <= 5;
        case 'weekends':
            return dayIndex === 0 || dayIndex === 6;
        case 'custom':
            return Array.isArray(normalized.days_of_week)
                ? normalized.days_of_week.includes(dayIndex)
                : false;
        case 'daily':
        default:
            return true;
    }
};

const buildInstanceItems = (templateItems = []) => (
    templateItems
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((item) => ({
            template_item_id: item.id,
            title: item.title,
            notes: item.notes || null,
            duration_minutes: item.duration_minutes ?? null,
            start_time: item.start_time || null,
            end_time: item.end_time || null,
            order: item.order,
            status: 'pending'
        }))
);

const computeItemSlot = (item, rollingStart) => {
    const normalizedStart = normalizeTimeToSeconds(item.start_time);
    const normalizedEnd = normalizeTimeToSeconds(item.end_time);
    const duration = Number.isFinite(item.duration_minutes) ? item.duration_minutes : parseInt(item.duration_minutes, 10);
    const durationMinutes = Number.isFinite(duration) ? duration : null;

    let startMinutes = timeToMinutes(normalizedStart);
    let endMinutes = timeToMinutes(normalizedEnd);

    if (!Number.isFinite(startMinutes)) {
        if (Number.isFinite(rollingStart)) {
            startMinutes = rollingStart;
        } else if (Number.isFinite(durationMinutes)) {
            startMinutes = timeToMinutes(DEFAULT_DAY_START);
        }
    }

    if (!Number.isFinite(endMinutes) && Number.isFinite(startMinutes) && Number.isFinite(durationMinutes)) {
        endMinutes = startMinutes + durationMinutes;
    }

    if (!Number.isFinite(startMinutes) && Number.isFinite(endMinutes) && Number.isFinite(durationMinutes)) {
        startMinutes = endMinutes - durationMinutes;
    }

    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
        return { slot: null, nextStart: rollingStart };
    }

    if (endMinutes <= startMinutes) {
        return { slot: null, nextStart: rollingStart };
    }

    const start_time = minutesToTime(startMinutes);
    const end_time = minutesToTime(endMinutes);

    if (!start_time || !end_time) {
        return { slot: null, nextStart: rollingStart };
    }

    return {
        slot: {
            start_time,
            end_time,
            duration_minutes: endMinutes - startMinutes
        },
        nextStart: endMinutes
    };
};

const buildScheduleSlotsFromInstance = (instance) => {
    let rollingStart = null;
    const slots = [];

    instance.items
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .forEach((item) => {
            const { slot, nextStart } = computeItemSlot(item, rollingStart);
            if (slot) {
                slots.push({
                    title: item.title,
                    description: item.notes || null,
                    priority: 'medium',
                    status: item.status || 'pending',
                    start_time: slot.start_time,
                    end_time: slot.end_time,
                    duration_minutes: slot.duration_minutes,
                    routine_template_id: instance.template_id,
                    routine_instance_id: instance.id,
                    routine_item_id: item.id,
                    source: 'routine'
                });
                rollingStart = nextStart;
            } else if (Number.isFinite(nextStart)) {
                rollingStart = nextStart;
            }
        });

    return slots;
};

const buildAnalyticsPayload = (instances) => {
    const allItems = instances.flatMap((instance) => instance.items || []);
    const total_items = allItems.length;
    const completed_items = allItems.filter((item) => item.status === 'completed').length;
    const skipped_items = allItems.filter((item) => item.status === 'skipped').length;
    return { total_items, completed_items, skipped_items };
};

const migrateLegacyRoutines = async (userId) => {
    const legacyRoutines = await Routine.findByUser(userId, false);
    if (!legacyRoutines.length) return [];

    const existingTemplates = await RoutineTemplate.findByUser(userId, false);
    const existingLegacyIds = new Set(existingTemplates.map((tpl) => tpl.legacy_routine_id).filter(Boolean));

    const migrated = [];

    for (const routine of legacyRoutines) {
        if (existingLegacyIds.has(routine.id)) continue;
        const tasks = await RoutineTask.findByRoutine(routine.id);
        const items = tasks.map((task) => ({
            id: task.id,
            title: task.task_template?.title || 'Untitled',
            notes: task.task_template?.description || null,
            duration_minutes: task.task_template?.duration_minutes || null,
            start_time: task.task_template?.scheduled_time || null,
            end_time: null,
            order: task.task_order || 0,
            completion_tracking: true
        }));

        const template = await RoutineTemplate.create({
            user_id: userId,
            name: routine.name,
            description: routine.description || null,
            color: '#6366F1',
            icon: null,
            is_active: routine.is_active !== false,
            created_by: userId,
            recurrence: { type: 'daily' },
            items,
            legacy_routine_id: routine.id
        });

        migrated.push(template);
    }

    return migrated;
};

const ensureDailyInstances = async (userId, date) => {
    await migrateLegacyRoutines(userId);

    const templates = await RoutineTemplate.findByUser(userId, true);
    const instances = await RoutineInstance.findByUserAndDate(userId, date);
    const existingByTemplate = new Map(instances.map((instance) => [instance.template_id, instance]));

    const createdInstances = [];

    for (const template of templates) {
        if (!matchesRecurrence(template.recurrence, date)) continue;
        if (existingByTemplate.has(template.id)) continue;

        const instance = await RoutineInstance.create({
            user_id: userId,
            template_id: template.id,
            date,
            name: template.name,
            description: template.description || null,
            color: template.color || '#6366F1',
            icon: template.icon || null,
            is_active: template.is_active !== false,
            items: buildInstanceItems(template.items || [])
        });

        createdInstances.push(instance);
    }

    const refreshed = await RoutineInstance.findByUserAndDate(userId, date);
    return { instances: refreshed, created: createdInstances };
};

const updateRoutineAnalytics = async (userId, date) => {
    const instances = await RoutineInstance.findByUserAndDate(userId, date);
    const payload = buildAnalyticsPayload(instances);
    await RoutineAnalytics.upsert(userId, date, payload);
    return payload;
};

const syncInstanceItemSchedule = async (instanceId, itemId, scheduleTask) => {
    return RoutineInstance.updateItem(instanceId, itemId, {
        start_time: scheduleTask.slot_start_time,
        end_time: scheduleTask.slot_end_time,
        duration_minutes: scheduleTask.duration_minutes,
        scheduled_task_id: scheduleTask.id
    });
};

const clearInstanceItemSchedule = async (instanceId, itemId) => (
    RoutineInstance.updateItem(instanceId, itemId, {
        start_time: null,
        end_time: null,
        scheduled_task_id: null
    })
);

const updateInstanceItemFromScheduleTask = async (scheduleTask) => {
    if (!scheduleTask?.routine_instance_id || !scheduleTask?.routine_item_id) return null;
    return syncInstanceItemSchedule(scheduleTask.routine_instance_id, scheduleTask.routine_item_id, scheduleTask);
};

const updateInstanceItemStatus = async (userId, instanceId, itemId, status) => {
    const updated = await RoutineInstance.updateItem(instanceId, itemId, {
        status,
        completed_at: status === 'completed' ? new Date() : null
    });
    if (updated?.date) {
        await updateRoutineAnalytics(userId, updated.date);
    }
    return updated;
};

const updateInstanceItem = async (userId, instanceId, itemId, updates) => {
    const sanitized = {
        title: updates.title,
        notes: updates.notes,
        duration_minutes: updates.duration_minutes,
        start_time: updates.start_time,
        end_time: updates.end_time,
        order: updates.order,
        status: updates.status
    };

    const updated = await RoutineInstance.updateItem(instanceId, itemId, sanitized);
    if (updated?.date) {
        await updateRoutineAnalytics(userId, updated.date);
    }
    return updated;
};

const updateTemplateAndFutureInstances = async (userId, templateId, updates) => {
    const template = await RoutineTemplate.findById(templateId);
    if (!template || template.user_id !== userId) return null;

    const updatedTemplate = await RoutineTemplate.update(templateId, updates);

    return updatedTemplate;
};

module.exports = {
    normalizeTimeToSeconds,
    timeToMinutes,
    minutesToTime,
    normalizeRecurrence,
    buildScheduleSlotsFromInstance,
    ensureDailyInstances,
    updateRoutineAnalytics,
    updateInstanceItemFromScheduleTask,
    updateInstanceItemStatus,
    updateInstanceItem,
    clearInstanceItemSchedule,
    updateTemplateAndFutureInstances,
    RoutineTemplate,
    RoutineInstance,
    RoutineAnalytics
};
