/**
 * Calendar maths for YYYY-MM and YYYY-MM-DD strings. Pure - imports nothing.
 *
 * Every date the wallet handles is a plain string in the USER's timezone, never
 * a Date. So every helper here builds its Date with Date.UTC and reads it back
 * with timeZone: 'UTC': parsing '2026-08-01' as local time in Colombo and
 * formatting it in UTC is how the 1st becomes the 31st of July.
 *
 * Extracted from pages/Wallet.jsx so the page and components/wallet/
 * WalletCalendar.jsx share one implementation instead of drifting apart.
 */

export const pad = (value) => `${value}`.padStart(2, '0');

/** Browser-local current month, only ever a starting point. */
export const currentYearMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

/** Browser-local today. Like currentYearMonth, only ever a fallback - the
 *  server owns the user's real today, resolved in their timezone. */
export const localYmd = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const shiftYearMonth = (ym, months) => {
    const [year, month] = ym.split('-').map(Number);
    const dt = new Date(Date.UTC(year, (month - 1) + months, 1));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
};

/** Days in a month. Day 0 of the NEXT month is the last day of this one, so
 *  February works out at 28 or 29 without a leap-year branch. */
export const daysInMonth = (ym) => {
    const [year, month] = ym.split('-').map(Number);
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
};

/** Weekday the month starts on, 0 = Sunday. Read in UTC so it never shifts. */
export const firstWeekdayOf = (ym) => {
    const [year, month] = ym.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
};

/** 'YYYY-MM' + a day number -> 'YYYY-MM-DD'. */
export const ymdOf = (ym, day) => `${ym}-${pad(day)}`;

export const monthLabel = (ym) => {
    const [year, month] = ym.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
        month: 'long', year: 'numeric', timeZone: 'UTC'
    });
};

/** 'Aug 8'. Deliberately without a weekday: the expense row's date column is
 *  4.5rem wide and 'Fri, Aug 8' does not fit in it. */
export const dayLabel = (ymd) => {
    const [year, month, day] = ymd.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', timeZone: 'UTC'
    });
};

/** 'Fri, Aug 8' - for headings, where there is room for the weekday. */
export const weekdayDayLabel = (ymd) => {
    const [year, month, day] = ymd.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC'
    });
};

/** 'Friday, 8 August 2026' - the spoken part of a calendar cell's name, where
 *  an abbreviation would be read out letter by letter. */
export const fullDayLabel = (ymd) => {
    const [year, month, day] = ymd.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    });
};
