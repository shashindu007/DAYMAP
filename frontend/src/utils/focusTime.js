/**
 * Time helpers for focus sessions. Extracted from FocusDashboard so the
 * session engine, the panel and the page can all share one implementation.
 */

export const DEFAULT_FOCUS_DURATION_MINUTES = 50;
export const MIN_FOCUS_DURATION_MINUTES = 1;
export const MAX_FOCUS_DURATION_MINUTES = 240;

export const FOCUS_CATEGORY_OPTIONS = [
    'Deep Work',
    'Learning',
    'Reading',
    'Writing',
    'Coding',
    'Planning',
    'Admin',
    'Meetings',
    'Custom'
];

export const FOCUS_GOAL_PRESETS = [
    'Finish a focused 25-min sprint',
    'Complete one chapter / section',
    'Clear priority inbox tasks',
    'Write 300 words',
    'Solve one tough problem'
];

export const toYmd = (date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const toHms = (date) => (
    `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}:${`${date.getSeconds()}`.padStart(2, '0')}`
);

export const formatElapsed = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const hh = Math.floor(safe / 3600);
    const mm = Math.floor((safe % 3600) / 60);
    const ss = safe % 60;
    return `${`${hh}`.padStart(2, '0')}:${`${mm}`.padStart(2, '0')}:${`${ss}`.padStart(2, '0')}`;
};

export const timeToMinutes = (value) => {
    if (!value) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    return (hours * 60) + minutes;
};

export const normalizeFocusDurationMinutes = (value, fallback = DEFAULT_FOCUS_DURATION_MINUTES) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(MAX_FOCUS_DURATION_MINUTES, Math.max(MIN_FOCUS_DURATION_MINUTES, parsed));
};

export const resolveFocusErrorMessage = (error, fallback) => (
    error?.errors?.[0]?.message
    || error?.error
    || error?.message
    || fallback
);

export const extractFocusPayload = (response) => (
    response?.data
    || response?.data?.data
    || response
    || {}
);
