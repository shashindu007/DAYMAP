/**
 * When a reminder is due, expressed as pure predicates over the normalized
 * day-item shape from dayItems.js. No React, no side effects - the engine
 * decides what to do with the answer.
 */

import { isResolvedStatus } from './taskStatus';

/**
 * How long after a slot ends the "did you finish?" nudge is still worth
 * sending. Past this it is archaeology, not a prompt.
 */
export const END_GRACE_MINUTES = 30;

/** How long after a start time an at-start ping is still honest. */
export const START_GRACE_MINUTES = 5;

export const DIGEST_KEY = 'digest';

export const buildTriggerKey = (type, item) => `${type}:${item.key}`;

/**
 * Collect every trigger that is due and has not already fired.
 *
 * @param {Array}  items        normalized day items
 * @param {Number} nowMinutes   minutes since local midnight
 * @param {Object} prefs        complete notification preferences
 * @param {Set}    firedKeys    trigger keys already in today's ledger
 * @param {Object} snoozes      triggerKey -> minute the snooze expires
 */
export const collectDueTriggers = (items, nowMinutes, prefs, firedKeys, snoozes = {}) => {
    const out = [];

    const push = (type, item, dueMinutes) => {
        const key = buildTriggerKey(type, item);
        const snoozedUntil = snoozes[key];
        const isSnoozed = Number.isFinite(snoozedUntil);
        const effectiveDue = isSnoozed ? snoozedUntil : dueMinutes;

        // A snooze deliberately re-arms a key that has already fired.
        if (firedKeys.has(key) && !isSnoozed) return;
        if (nowMinutes < effectiveDue) return;

        out.push({ type, item, key, dueMinutes: effectiveDue });
    };

    items.forEach((item) => {
        // Never nag about work the user has already answered for. Reusing
        // isResolvedStatus keeps this in step with how bucketDayItems sorts.
        if (isResolvedStatus(item.status)) return;

        const { startMinutes, endMinutes } = item;

        // The `anytime` bucket has no clock to hang a reminder on. Firing at
        // some arbitrary moment is how people learn to switch notifications
        // off; these surface in the digest and the glance line instead.
        if (!Number.isFinite(startMinutes)) return;

        // Pre-start. The upper bound matters: once a task has started,
        // "Happening Now" on the dashboard is the better signal than a toast.
        if (prefs.lead_minutes > 0 && nowMinutes < startMinutes) {
            push('pre_start', item, startMinutes - prefs.lead_minutes);
        }

        if (prefs.notify_on_start && nowMinutes < startMinutes + START_GRACE_MINUTES) {
            push('start', item, startMinutes);
        }

        // This is the needsReview bucket crossing its threshold, delivered
        // instead of waiting to be discovered.
        if (prefs.notify_on_end
            && Number.isFinite(endMinutes)
            && nowMinutes < endMinutes + END_GRACE_MINUTES) {
            push('end', item, endMinutes);
        }
    });

    return out.sort((a, b) => a.dueMinutes - b.dueMinutes);
};

/**
 * The next few reminders that have not fired yet, for the "Coming up" section
 * of the notification centre. Derived on demand - nothing to persist.
 */
export const collectUpcomingTriggers = (items, nowMinutes, prefs, firedKeys, limit = 5) => {
    const out = [];

    const consider = (type, item, dueMinutes) => {
        const key = buildTriggerKey(type, item);
        if (firedKeys.has(key) || dueMinutes <= nowMinutes) return;
        out.push({ type, item, key, dueMinutes });
    };

    items.forEach((item) => {
        if (isResolvedStatus(item.status)) return;
        const { startMinutes, endMinutes } = item;
        if (!Number.isFinite(startMinutes)) return;

        if (prefs.lead_minutes > 0) consider('pre_start', item, startMinutes - prefs.lead_minutes);
        if (prefs.notify_on_start) consider('start', item, startMinutes);
        if (prefs.notify_on_end && Number.isFinite(endMinutes)) consider('end', item, endMinutes);
    });

    return out.sort((a, b) => a.dueMinutes - b.dueMinutes).slice(0, limit);
};

const minutesToLabel = (minutes) => {
    if (!Number.isFinite(minutes)) return '';
    const clamped = Math.min(1439, Math.max(0, Math.round(minutes)));
    return `${`${Math.floor(clamped / 60)}`.padStart(2, '0')}:${`${clamped % 60}`.padStart(2, '0')}`;
};

/** "in 25 min" / "in 1h 10m", computed live so the copy never goes stale. */
const relativeLabel = (deltaMinutes) => {
    const delta = Math.max(0, Math.round(deltaMinutes));
    if (delta < 1) return 'now';
    if (delta < 60) return `in ${delta} min`;
    const hours = Math.floor(delta / 60);
    const minutes = delta % 60;
    return minutes === 0 ? `in ${hours}h` : `in ${hours}h ${minutes}m`;
};

/**
 * Human copy for a trigger. Computed from the LIVE clock rather than from the
 * scheduled due time, so a reminder that fires late still tells the truth
 * about how long you have.
 */
export const describeTrigger = (trigger, nowMinutes, routineName = null) => {
    const { type, item } = trigger;
    const slot = item.startLabel
        ? `${item.startLabel}${item.endLabel ? `–${item.endLabel}` : ''}`
        : '';

    const detail = [slot, item.category, routineName].filter(Boolean).join(' · ');

    switch (type) {
        case 'pre_start':
            return {
                title: `${item.title} starts ${relativeLabel(item.startMinutes - nowMinutes)}`,
                body: detail,
                tone: 'info'
            };
        case 'start':
            return {
                title: `${item.title} starts now`,
                body: detail,
                tone: 'info'
            };
        case 'end':
            return {
                title: `Did you finish ${item.title}?`,
                body: detail || 'Mark it so today stays accurate.',
                tone: 'warning'
            };
        default:
            return { title: item.title, body: detail, tone: 'info' };
    }
};

/** "Reminder at 08:30" — the label for the Coming up list. */
export const describeUpcoming = (trigger) => {
    const at = minutesToLabel(trigger.dueMinutes);
    switch (trigger.type) {
        case 'pre_start':
            return `${at} · heads-up for ${trigger.item.title}`;
        case 'start':
            return `${at} · ${trigger.item.title} starts`;
        case 'end':
            return `${at} · check in on ${trigger.item.title}`;
        default:
            return `${at} · ${trigger.item.title}`;
    }
};

/**
 * The morning digest. Built from summarizeDay so its numbers and the
 * dashboard's at-a-glance line come from one calculation.
 */
export const describeDigest = (summary) => {
    const parts = [`${summary.total} ${summary.total === 1 ? 'task' : 'tasks'}`];
    if (summary.scheduledMinutes > 0) parts.push(`${summary.scheduledLabel} scheduled`);

    const tail = [];
    if (summary.firstUp?.startLabel) {
        tail.push(`First up: ${summary.firstUp.title} at ${summary.firstUp.startLabel}.`);
    }
    if (summary.anytime > 0) tail.push(`${summary.anytime} anytime.`);

    return {
        title: `Today: ${parts.join(', ')}`,
        body: tail.join(' '),
        tone: 'info'
    };
};
