/**
 * Notification preference defaults, and a normalizer for user documents that
 * predate the field.
 *
 * Mongoose schema defaults only apply when a document is CREATED, so every
 * account that existed before notifications shipped has no subtree at all.
 * Reading through this keeps the API response shape identical for old and new
 * accounts, so the client never has to special-case a missing object.
 *
 * Mirrored on the frontend in frontend/src/utils/notificationPrefs.js.
 */

const DEFAULT_NOTIFICATION_PREFERENCES = {
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

const HHMM_PATTERN = /^([0-1]\d|2[0-3]):[0-5]\d$/;

const asBoolean = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

const asHhmm = (value, fallback) => (
    typeof value === 'string' && HHMM_PATTERN.test(value) ? value : fallback
);

const asLeadMinutes = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 240) return fallback;
    return parsed;
};

/**
 * @param {Object|null} prefs raw subdocument off a user record
 * @returns {Object} a complete preference object, never partial
 */
const normalizeNotificationPreferences = (prefs) => {
    const source = prefs && typeof prefs === 'object' ? prefs : {};
    const quiet = source.quiet_hours && typeof source.quiet_hours === 'object'
        ? source.quiet_hours
        : {};
    const defaults = DEFAULT_NOTIFICATION_PREFERENCES;

    return {
        enabled: asBoolean(source.enabled, defaults.enabled),
        lead_minutes: asLeadMinutes(source.lead_minutes, defaults.lead_minutes),
        notify_on_start: asBoolean(source.notify_on_start, defaults.notify_on_start),
        notify_on_end: asBoolean(source.notify_on_end, defaults.notify_on_end),
        daily_digest: asBoolean(source.daily_digest, defaults.daily_digest),
        digest_time: asHhmm(source.digest_time, defaults.digest_time),
        quiet_hours: {
            enabled: asBoolean(quiet.enabled, defaults.quiet_hours.enabled),
            start: asHhmm(quiet.start, defaults.quiet_hours.start),
            end: asHhmm(quiet.end, defaults.quiet_hours.end)
        },
        browser_push: asBoolean(source.browser_push, defaults.browser_push)
    };
};

module.exports = {
    DEFAULT_NOTIFICATION_PREFERENCES,
    HHMM_PATTERN,
    normalizeNotificationPreferences
};
