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

/**
 * `YYYY-MM` month key. Exported so validator.js can .matches() it rather than
 * re-typing the pattern — the same arrangement as HHMM_PATTERN in
 * utils/notificationPrefs.js.
 */
const YM_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const isYearMonth = (value) => typeof value === 'string' && YM_PATTERN.test(value);

/** The user's current local month as `YYYY-MM`. */
const getUserYearMonth = (timezone, baseDate = new Date()) => (
    getUserYmd(timezone, baseDate).slice(0, 7)
);

/**
 * Inclusive `YYYY-MM-DD` bounds for a `YYYY-MM` key, or null if malformed so
 * the caller can 400 rather than silently querying a nonsense range.
 *
 * Analytics.findByMonth hardcodes `-31` as the end bound. That is harmless
 * there because it is only ever a lexicographic $lte and nothing sorts between
 * '2026-02-28' and '2026-02-31'. It is NOT harmless here: this end date is
 * echoed to the client and rendered as a range label, and "1 Feb - 31 Feb" is
 * a visible bug.
 */
const monthRange = (ym) => {
    if (!isYearMonth(ym)) return null;
    const [year, month] = ym.split('-').map(Number);
    // Day 0 of the NEXT month is the last day of this one - covers 28/29/30/31
    // and leap years with no table and no branch.
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { start: `${ym}-01`, end: `${ym}-${`${lastDay}`.padStart(2, '0')}` };
};

/** Step a `YYYY-MM` key by whole months. Powers the month stepper. */
const addMonthsToYm = (ym, months) => {
    if (!isYearMonth(ym)) return ym;
    const [year, month] = ym.split('-').map(Number);
    const dt = new Date(Date.UTC(year, (month - 1) + months, 1));
    return `${dt.getUTCFullYear()}-${`${dt.getUTCMonth() + 1}`.padStart(2, '0')}`;
};

module.exports = {
    getUserYmd,
    addDaysToYmd,
    getUserToday,
    getUserTomorrow,
    eachYmd,
    YM_PATTERN,
    isYearMonth,
    getUserYearMonth,
    monthRange,
    addMonthsToYm
};
