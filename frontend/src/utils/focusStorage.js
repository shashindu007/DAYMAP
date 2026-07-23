/**
 * localStorage persistence for an in-flight focus session, so a refresh or a
 * navigation mid-sprint does not lose the user's time.
 *
 * The key stays at v1: bumping it would orphan any session that happens to be
 * running when a new build ships.
 */

const FOCUS_STORAGE_PREFIX = 'daymap.focus.session.v1';

export const buildFocusStorageKey = (userId) => `${FOCUS_STORAGE_PREFIX}:${userId || 'anonymous'}`;

export const readFocusStorage = (userId) => {
    try {
        const raw = localStorage.getItem(buildFocusStorageKey(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
};

export const writeFocusStorage = (userId, payload) => {
    try {
        localStorage.setItem(buildFocusStorageKey(userId), JSON.stringify(payload));
    } catch {
        // Ignore storage write failures (private mode, quota exceeded, etc.)
    }
};

export const clearFocusStorage = (userId) => {
    try {
        localStorage.removeItem(buildFocusStorageKey(userId));
    } catch {
        // Ignore storage removal failures
    }
};
