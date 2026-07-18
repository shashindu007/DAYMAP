/**
 * Time string helpers shared across controllers/services.
 */

/**
 * Normalize a clock string to `HH:MM:SS`, or null if it is not a valid time.
 * Accepts `HH:MM` (seconds default to 00) or `HH:MM:SS`.
 */
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

module.exports = {
    normalizeTimeToSeconds
};
