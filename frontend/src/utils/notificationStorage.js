/**
 * localStorage persistence for today's notifications.
 *
 * Two jobs:
 *  1. A per-day ledger, so a page reload does not re-fire every reminder that
 *     already went out, and so the notification centre has something to show.
 *  2. A leader lease, so two open tabs do not each deliver the same reminder.
 *
 * Follows the same shape as focusStorage.js: versioned prefix, buildKey by
 * user, and every access swallows failure (private mode, quota, disabled
 * storage) rather than taking the app down with it.
 */

const NOTIFICATION_STORAGE_PREFIX = 'daymap.notifications.v1';
const LEADER_KEY = 'daymap.notifications.leader.v1';

/** Older entries are history nobody scrolls to; the cap just bounds quota. */
const MAX_ENTRIES = 200;

/** A lease older than this is assumed to belong to a closed tab. */
export const LEADER_LEASE_MS = 25000;

export const buildNotificationStorageKey = (userId) => (
    `${NOTIFICATION_STORAGE_PREFIX}:${userId || 'anonymous'}`
);

export const emptyLedger = (date) => ({ version: 1, date, entries: [], snoozes: {} });

/**
 * Reading on a new date returns a fresh ledger and discards yesterday - that
 * is the entire pruning strategy, so nothing accumulates across days.
 */
export const readNotificationLedger = (userId, todayYmd) => {
    try {
        const raw = localStorage.getItem(buildNotificationStorageKey(userId));
        if (!raw) return emptyLedger(todayYmd);

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return emptyLedger(todayYmd);
        if (parsed.version !== 1 || parsed.date !== todayYmd) return emptyLedger(todayYmd);

        return {
            ...emptyLedger(todayYmd),
            ...parsed,
            entries: Array.isArray(parsed.entries) ? parsed.entries : [],
            snoozes: parsed.snoozes && typeof parsed.snoozes === 'object' ? parsed.snoozes : {}
        };
    } catch {
        return emptyLedger(todayYmd);
    }
};

export const writeNotificationLedger = (userId, ledger) => {
    try {
        const capped = { ...ledger, entries: (ledger.entries || []).slice(-MAX_ENTRIES) };
        localStorage.setItem(buildNotificationStorageKey(userId), JSON.stringify(capped));
    } catch {
        // Storage unavailable - the in-memory ledger still works for this
        // session, it just will not survive a reload.
    }
};

export const clearNotificationLedger = (userId) => {
    try {
        localStorage.removeItem(buildNotificationStorageKey(userId));
    } catch {
        // Ignore storage removal failures
    }
};

/* ==========================================================================
   Leader lease — one delivering tab at a time.
   ========================================================================== */

export const createTabId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Claim or renew the right to deliver. Without this, N open tabs means N
 * identical toasts and N identical desktop notifications for one reminder.
 *
 * @returns {Boolean} whether this tab may deliver right now
 */
export const claimNotificationLeadership = (tabId) => {
    try {
        const raw = localStorage.getItem(LEADER_KEY);
        const current = raw ? JSON.parse(raw) : null;
        const now = Date.now();

        const isVacant = !current || typeof current !== 'object';
        const isStale = current && (now - Number(current.at || 0) > LEADER_LEASE_MS);
        const isOurs = current && current.tabId === tabId;

        if (!isVacant && !isStale && !isOurs) return false;

        localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId, at: now }));
        return true;
    } catch {
        // No storage means no coordination possible. A single tab is the
        // common case, so delivering is better than going silent.
        return true;
    }
};

export const releaseNotificationLeadership = (tabId) => {
    try {
        const raw = localStorage.getItem(LEADER_KEY);
        const current = raw ? JSON.parse(raw) : null;
        if (current?.tabId === tabId) localStorage.removeItem(LEADER_KEY);
    } catch {
        // Ignore - the lease expires on its own.
    }
};
