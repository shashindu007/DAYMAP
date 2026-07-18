/**
 * Date helpers for deriving calendar dates in a user's local timezone.
 *
 * The app stores dates as `YYYY-MM-DD` strings. Deriving "today"/"tomorrow"
 * from `new Date().toISOString()` uses UTC, which resolves to the wrong day
 * for users east/west of UTC during part of the day. These helpers use the
 * per-user `timezone` (an IANA name, e.g. "Asia/Colombo") to compute the
 * correct local calendar date without any external dependency.
 */

/**
 * Format a Date as `YYYY-MM-DD` as seen in the given IANA timezone.
 * Falls back to UTC if the timezone is missing or invalid.
 */
const getUserYmd = (timezone, baseDate = new Date()) => {
    const format = (tz) => new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(baseDate);

    try {
        return format(timezone || 'UTC');
    } catch (error) {
        // Invalid timezone string → safe fallback.
        return format('UTC');
    }
};

/**
 * Add (or subtract) whole days to a `YYYY-MM-DD` string, returning a
 * `YYYY-MM-DD` string. Pure string/date arithmetic — timezone independent.
 */
const addDaysToYmd = (ymd, days) => {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    const yy = dt.getUTCFullYear();
    const mm = `${dt.getUTCMonth() + 1}`.padStart(2, '0');
    const dd = `${dt.getUTCDate()}`.padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
};

/** The user's current local date as `YYYY-MM-DD`. */
const getUserToday = (timezone) => getUserYmd(timezone);

/** The user's next local date as `YYYY-MM-DD`. */
const getUserTomorrow = (timezone) => addDaysToYmd(getUserToday(timezone), 1);

/**
 * Inclusive list of `YYYY-MM-DD` strings from startYmd to endYmd.
 * Returns [] if inputs are malformed or the range is inverted.
 * Capped at 366 days as a safety guard.
 */
const eachYmd = (startYmd, endYmd) => {
    const isYmd = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!isYmd(startYmd) || !isYmd(endYmd) || startYmd > endYmd) {
        return [];
    }
    const out = [];
    let cursor = startYmd;
    let guard = 0;
    while (cursor <= endYmd && guard < 366) {
        out.push(cursor);
        cursor = addDaysToYmd(cursor, 1);
        guard += 1;
    }
    return out;
};

module.exports = {
    getUserYmd,
    addDaysToYmd,
    getUserToday,
    getUserTomorrow,
    eachYmd
};
