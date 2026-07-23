/**
 * Today's Dashboard mixes two record types: schedule tasks (timeline blocks,
 * from /schedules) and free-form tasks (from /tasks, e.g. logged after an
 * ad-hoc focus session). This normalizes both into one shape so the page can
 * bucket and render them uniformly.
 */

export const timeToMinutes = (value) => {
    if (!value) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return (hours * 60) + minutes;
};

/**
 * Mirrors the server's resolveEndMinutes: an end time of 00:00 means midnight
 * at the END of the day (1440), not the very start of it. Without this a task
 * ending at midnight looks like it finished before it began.
 */
export const resolveEndMinutes = (startMinutes, endMinutes) => {
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return null;
    if (endMinutes === 0 && startMinutes > 0) return 1440;
    return endMinutes;
};

export const formatDisplayTime = (timeValue) => {
    if (!timeValue) return '';
    return timeValue.length >= 5 ? timeValue.slice(0, 5) : timeValue;
};

const minutesToLabel = (minutes) => {
    if (!Number.isFinite(minutes)) return '';
    const normalized = Math.min(1439, Math.max(0, minutes));
    const hh = `${Math.floor(normalized / 60)}`.padStart(2, '0');
    const mm = `${normalized % 60}`.padStart(2, '0');
    return `${hh}:${mm}`;
};

/**
 * @param {Object} record  raw ScheduleTask or Task
 * @param {'schedule'|'task'} kind
 */
export const normalizeDayItem = (record, kind) => {
    if (!record) return null;

    const isSchedule = kind === 'schedule';
    const rawStart = isSchedule ? record.slot_start_time : record.scheduled_time;
    const startMinutes = timeToMinutes(rawStart);

    let endMinutes;
    let endLabel;
    if (isSchedule) {
        endMinutes = resolveEndMinutes(startMinutes, timeToMinutes(record.slot_end_time));
        endLabel = formatDisplayTime(record.slot_end_time);
    } else {
        // Free-form tasks carry a start plus a duration, not an end time.
        const span = record.duration_minutes ?? record.actual_duration_minutes;
        endMinutes = Number.isFinite(startMinutes) && Number.isFinite(span)
            ? startMinutes + span
            : startMinutes;
        endLabel = Number.isFinite(endMinutes) ? minutesToLabel(endMinutes) : '';
    }

    return {
        // Ids come from two different collections - never assume they are
        // unique across both.
        key: `${kind}:${record.id}`,
        id: record.id,
        kind,
        title: record.title,
        description: record.description || '',
        category: record.category || null,
        priority: record.priority || 'medium',
        status: record.status || 'pending',
        startMinutes,
        endMinutes,
        startLabel: formatDisplayTime(rawStart),
        endLabel,
        durationMinutes: record.duration_minutes ?? null,
        actualMinutes: record.actual_duration_minutes ?? null,
        isRoutine: isSchedule && (record.source === 'routine' || Boolean(record.routine_item_id)),
        routineInstanceId: isSchedule ? (record.routine_instance_id || null) : null,
        routineItemId: isSchedule ? (record.routine_item_id || null) : null,
        raw: record
    };
};

export const sortByStart = (a, b) => (
    (a.startMinutes ?? Number.POSITIVE_INFINITY) - (b.startMinutes ?? Number.POSITIVE_INFINITY)
);

/**
 * Single pass, first match wins - that ordering is what guarantees the buckets
 * are mutually exclusive so nothing renders twice.
 */
export const bucketDayItems = (items, nowMinutes) => {
    const buckets = {
        completed: [],
        incomplete: [],
        anytime: [],
        needsReview: [],
        current: [],
        upcoming: []
    };

    items.forEach((item) => {
        if (item.status === 'completed') {
            buckets.completed.push(item);
        } else if (item.status === 'missed' || item.status === 'cancelled') {
            buckets.incomplete.push(item);
        } else if (!Number.isFinite(item.startMinutes)) {
            buckets.anytime.push(item);
        } else if (Number.isFinite(item.endMinutes) && item.endMinutes <= nowMinutes) {
            // Slot has ended but the user never said whether it happened.
            buckets.needsReview.push(item);
        } else if (item.startMinutes <= nowMinutes) {
            buckets.current.push(item);
        } else {
            buckets.upcoming.push(item);
        }
    });

    Object.values(buckets).forEach((bucket) => bucket.sort(sortByStart));
    return buckets;
};

export const getProgressPercent = (item, nowMinutes) => {
    const { startMinutes, endMinutes } = item;
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes) {
        return 0;
    }
    if (nowMinutes >= endMinutes) return 100;
    if (nowMinutes <= startMinutes) return 0;
    return Math.min(100, Math.max(0, ((nowMinutes - startMinutes) / (endMinutes - startMinutes)) * 100));
};
