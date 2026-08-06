/**
 * Frontend mirror of backend/src/utils/notificationPrefs.js.
 *
 * The backend normalizes on read, but this merge is the one that actually
 * protects the engine: it guarantees a complete preference object regardless
 * of what the API returned, including before the first save and for accounts
 * that predate the feature.
 */

export const DEFAULT_NOTIFICATION_PREFS = {
    enabled: true,
    lead_minutes: 30,
    notify_on_start: true,
    notify_on_end: true,
    daily_digest: true,
    digest_time: '07:00',
    quiet_hours: {
        enabled: false,
        start: '22:00',
        end: '07:00'
    },
    browser_push: false
};

/** Lead-time choices. A select, not a free number input - one tap, no typos. */
export const LEAD_MINUTE_OPTIONS = [5, 10, 15, 30, 45, 60];

export const mergeNotificationPrefs = (raw) => ({
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(raw || {}),
    quiet_hours: {
        ...DEFAULT_NOTIFICATION_PREFS.quiet_hours,
        ...(raw?.quiet_hours || {})
    }
});

/** '07:00' -> 420. Null for anything unparseable, so callers can skip cleanly. */
export const hhmmToMinutes = (value) => {
    if (typeof value !== 'string') return null;
    const match = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) return null;
    return (Number(match[1]) * 60) + Number(match[2]);
};

/**
 * Quiet hours normally wrap past midnight (22:00 -> 07:00), so the naive
 * `start <= now < end` test would be false for the entire window.
 */
export const isWithinQuietHours = (nowMinutes, quietHours) => {
    if (!quietHours?.enabled) return false;

    const start = hhmmToMinutes(quietHours.start);
    const end = hhmmToMinutes(quietHours.end);
    if (start === null || end === null || start === end) return false;

    return start > end
        ? (nowMinutes >= start || nowMinutes < end)   // wraps midnight
        : (nowMinutes >= start && nowMinutes < end);
};
