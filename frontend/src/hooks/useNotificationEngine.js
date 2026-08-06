import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useTodayItems from './useTodayItems';
import { summarizeDay } from '../utils/dayItems';
import {
    DIGEST_KEY,
    collectDueTriggers,
    collectUpcomingTriggers,
    describeDigest,
    describeTrigger
} from '../utils/notificationRules';
import {
    claimNotificationLeadership,
    createTabId,
    readNotificationLedger,
    releaseNotificationLeadership,
    writeNotificationLedger
} from '../utils/notificationStorage';
import { hhmmToMinutes, isWithinQuietHours, mergeNotificationPrefs } from '../utils/notificationPrefs';

/**
 * The reminder engine.
 *
 * Ticks on a coarse interval, asks notificationRules what is due, and delivers
 * anything new on two surfaces: an in-app toast and a desktop notification.
 * Every delivery is written to a per-day localStorage ledger, which is both
 * the dedupe mechanism and the backing store for the notification centre.
 *
 * Mirrors useFocusEngine: one instance, mounted in a provider above <Routes>,
 * inert until there is a signed-in user.
 */

/**
 * 30s, not 1s. Triggers are minute-granular, so this only bounds worst-case
 * lateness. Every evaluation reads the clock fresh, so interval drift can
 * never produce a wrong answer - it only affects how gaps are detected.
 */
const TICK_MS = 30000;
const LEASE_REFRESH_MS = 10000;

/** Three missed ticks means the tab was frozen or the machine slept. */
const WAKE_GAP_MS = 90000;

/** Fired this long after its due minute, a reminder is history, not a prompt. */
const GRACE_MINUTES = 10;

/** Past this many at once, deliver a single roll-up instead of a wall. */
const MAX_INDIVIDUAL_ON_WAKE = 3;

const SNOOZE_MINUTES = { pre_start: 5, start: 5, end: 10 };

const TZ_PROMPT_PREFIX = 'daymap.tzprompt.v1';

const canUseBrowserNotifications = typeof window !== 'undefined' && 'Notification' in window;

const detectTimezone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
        return null;
    }
};

const useNotificationEngine = () => {
    const { user, updateProfile } = useAuth();
    const { pushToast } = useToast();
    const navigate = useNavigate();

    const [now, setNow] = useState(new Date());
    const [ledger, setLedger] = useState(() => ({ version: 1, date: null, entries: [], snoozes: {} }));
    const [permission, setPermission] = useState(
        canUseBrowserNotifications ? Notification.permission : 'unsupported'
    );

    // NotificationProvider sits above every private route, so it is the one
    // consumer that owns fetching the day.
    const {
        todayYmd,
        dayItems,
        routineNameById,
        handleStatusUpdate,
        hydrated
    } = useTodayItems({ now, autoFetch: true });

    const prefs = useMemo(
        () => mergeNotificationPrefs(user?.notification_preferences),
        [user?.notification_preferences]
    );

    const tabIdRef = useRef(createTabId());
    const lastTickAtRef = useRef(Date.now());
    /**
     * The sweep runs from inside an interval, so it reads the ledger through a
     * ref rather than through state.
     *
     * This ref is written ONLY alongside a setLedger, never during render:
     * setLedger is asynchronous, and a sweep triggered in the same commit as a
     * load would otherwise still see the pre-load value and re-fire every
     * reminder that had already gone out.
     */
    const ledgerRef = useRef(ledger);

    const nowMinutes = (now.getHours() * 60) + now.getMinutes();

    /* ------------------------------------------------------------------ */
    /* Ledger                                                              */
    /* ------------------------------------------------------------------ */

    const commitLedger = useCallback((next, { write = true } = {}) => {
        ledgerRef.current = next;
        setLedger(next);
        if (write && user?.id) writeNotificationLedger(user.id, next);
    }, [user?.id]);

    // Loading is not a change worth writing back, so it skips the write.
    const loadLedger = useCallback(() => {
        if (!user?.id) return;
        commitLedger(readNotificationLedger(user.id, todayYmd), { write: false });
    }, [commitLedger, todayYmd, user?.id]);

    const persist = commitLedger;

    // A new date discards yesterday's ledger outright - that is the whole
    // pruning strategy. todayYmd is derived from the ticking clock, so this
    // fires on its own at midnight.
    useEffect(() => {
        if (!user?.id) return;
        loadLedger();
        // Rolling over is not a wake-up; don't let it look like one.
        lastTickAtRef.current = Date.now();
    }, [loadLedger, user?.id]);

    // Keep every tab's badge in step, including the ones not delivering.
    useEffect(() => {
        if (!user?.id) return undefined;
        const onStorage = (event) => {
            if (!event.key || !event.key.startsWith('daymap.notifications.v1')) return;
            loadLedger();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [loadLedger, user?.id]);

    const firedKeys = useMemo(
        () => new Set(ledger.entries.map((entry) => entry.key)),
        [ledger.entries]
    );

    /* ------------------------------------------------------------------ */
    /* Delivery                                                            */
    /* ------------------------------------------------------------------ */

    const showBrowserNotification = useCallback(({ title, body, tag, requireInteraction, silent }) => {
        if (!canUseBrowserNotifications || Notification.permission !== 'granted') return false;
        try {
            const notification = new Notification(title, {
                body,
                tag,               // a re-fire replaces its predecessor
                renotify: false,
                requireInteraction,
                silent
            });
            notification.onclick = () => {
                window.focus();
                navigate('/today');
                notification.close();
            };
            // Some platforms never fire onclose on their own.
            setTimeout(() => notification.close(), 20000);
            return true;
        } catch {
            return false;
        }
    }, [navigate]);

    const snoozeTrigger = useCallback((trigger, minutes) => {
        const current = ledgerRef.current;
        const untilMinutes = (new Date().getHours() * 60) + new Date().getMinutes() + minutes;
        persist({
            ...current,
            // Re-arms the key: collectDueTriggers honours a snooze even for a
            // trigger that already fired.
            snoozes: { ...current.snoozes, [trigger.key]: untilMinutes },
            entries: current.entries.filter((entry) => entry.key !== trigger.key)
        });
    }, [persist]);

    const actionsFor = useCallback((trigger) => {
        const snoozeMinutes = SNOOZE_MINUTES[trigger.type] || 5;
        const snooze = {
            key: 'snooze',
            label: `Snooze ${snoozeMinutes}m`,
            variant: 'secondary',
            onClick: () => snoozeTrigger(trigger, snoozeMinutes)
        };

        if (trigger.type === 'end') {
            return [
                {
                    key: 'complete',
                    label: 'Mark done',
                    variant: 'primary',
                    onClick: () => handleStatusUpdate(trigger.item, 'completed')
                },
                {
                    key: 'missed',
                    label: "Didn't do it",
                    variant: 'secondary',
                    onClick: () => handleStatusUpdate(trigger.item, 'missed')
                },
                snooze
            ];
        }

        return [
            { key: 'open', label: 'Open', variant: 'primary', onClick: () => navigate('/today') },
            snooze
        ];
    }, [handleStatusUpdate, navigate, snoozeTrigger]);

    /**
     * Build the ledger entry for a trigger and, unless quiet hours are on,
     * actually interrupt with it. Suppressed entries are still recorded -
     * quiet hours mutes the interruption, it does not discard the event.
     */
    const deliver = useCallback((trigger, atMinutes, quiet) => {
        const routineName = trigger.item.isRoutine
            ? routineNameById[trigger.item.routineInstanceId]
            : null;
        const { title, body, tone } = describeTrigger(trigger, atMinutes, routineName);

        let delivery = 'suppressed';
        if (!quiet) {
            pushToast({ title, body, tone, tag: trigger.key, actions: actionsFor(trigger) });
            const shown = showBrowserNotification({
                title,
                body,
                tag: trigger.key,
                // The "did you finish?" prompt should wait to be answered.
                requireInteraction: trigger.type === 'end',
                silent: false
            });
            delivery = shown ? 'toast+browser' : 'toast';
        }

        return {
            id: `${trigger.key}:${Date.now()}`,
            key: trigger.key,
            type: trigger.type,
            itemKey: trigger.item.key,
            title,
            body,
            tone,
            startLabel: trigger.item.startLabel || '',
            endLabel: trigger.item.endLabel || '',
            dueMinutes: trigger.dueMinutes,
            firedAt: Date.now(),
            delivery,
            read: false
        };
    }, [actionsFor, pushToast, routineNameById, showBrowserNotification]);

    const deliverRollup = useCallback((count, quiet) => {
        if (quiet) return;
        const title = `${count} reminder${count === 1 ? '' : 's'} while you were away`;
        pushToast({
            title,
            body: 'Open the bell to see what passed.',
            tone: 'muted',
            tag: 'daymap-rollup',
            duration: 10000
        });
        showBrowserNotification({ title, body: 'Open DayMap to review.', tag: 'daymap-rollup' });
    }, [pushToast, showBrowserNotification]);

    /* ------------------------------------------------------------------ */
    /* The sweep                                                           */
    /* ------------------------------------------------------------------ */

    const runSweep = useCallback((nowDate = new Date(), { isCatchUp = false } = {}) => {
        // Without the hydration guard the first tick after mount sees an empty
        // day and announces "0 tasks today" before the fetch has landed.
        if (!user?.id || !hydrated || !prefs.enabled) return;
        if (!claimNotificationLeadership(tabIdRef.current)) return;

        const atMinutes = (nowDate.getHours() * 60) + nowDate.getMinutes();
        const quiet = isWithinQuietHours(atMinutes, prefs.quiet_hours);
        const current = ledgerRef.current;
        const keys = new Set(current.entries.map((entry) => entry.key));

        const due = collectDueTriggers(dayItems, atMinutes, prefs, keys, current.snoozes);

        // The digest is content, not a moment - a 09:00 delivery of a 07:00
        // digest is still exactly right, so it skips the staleness partition.
        const digestMinutes = hhmmToMinutes(prefs.digest_time);
        const digestDue = prefs.daily_digest
            && !keys.has(DIGEST_KEY)
            && digestMinutes !== null
            && atMinutes >= digestMinutes;

        if (!due.length && !digestDue) return;

        const entries = [];

        if (digestDue) {
            const summary = summarizeDay(dayItems, atMinutes);
            const { title, body, tone } = describeDigest(summary);
            let delivery = 'suppressed';
            if (!quiet) {
                pushToast({
                    title,
                    body,
                    tone,
                    tag: DIGEST_KEY,
                    actions: [{ key: 'open', label: 'See today', variant: 'primary', onClick: () => navigate('/today') }]
                });
                const shown = showBrowserNotification({ title, body, tag: DIGEST_KEY });
                delivery = shown ? 'toast+browser' : 'toast';
            }
            entries.push({
                id: `${DIGEST_KEY}:${Date.now()}`,
                key: DIGEST_KEY,
                type: 'digest',
                itemKey: null,
                title,
                body,
                tone,
                startLabel: '',
                endLabel: '',
                dueMinutes: digestMinutes,
                firedAt: Date.now(),
                delivery,
                read: false
            });
        }

        const fresh = due.filter((trigger) => atMinutes - trigger.dueMinutes <= GRACE_MINUTES);
        const stale = due.filter((trigger) => atMinutes - trigger.dueMinutes > GRACE_MINUTES);

        // Stale triggers are recorded so the centre can show them, but they
        // never interrupt - their moment passed and re-ringing is just noise.
        stale.forEach((trigger) => {
            const entry = deliver(trigger, atMinutes, true);
            entries.push({ ...entry, delivery: 'suppressed', reason: 'stale' });
        });

        if (fresh.length <= MAX_INDIVIDUAL_ON_WAKE) {
            fresh.forEach((trigger) => entries.push(deliver(trigger, atMinutes, quiet)));
        } else {
            // Waking to eight separate toasts is worse than waking to one.
            fresh.forEach((trigger) => {
                const entry = deliver(trigger, atMinutes, true);
                entries.push({ ...entry, delivery: 'rolled-up' });
            });
            deliverRollup(fresh.length + stale.length, quiet);
        }

        if (isCatchUp && stale.length > 0 && fresh.length === 0) {
            deliverRollup(stale.length, quiet);
        }

        // Any snooze that just fired has served its purpose.
        const clearedSnoozes = { ...current.snoozes };
        [...fresh, ...stale].forEach((trigger) => { delete clearedSnoozes[trigger.key]; });

        persist({
            ...ledgerRef.current,
            snoozes: clearedSnoozes,
            entries: [...ledgerRef.current.entries, ...entries]
        });
    }, [
        dayItems, deliver, deliverRollup, hydrated, navigate, persist, prefs,
        pushToast, showBrowserNotification, user?.id
    ]);

    const sweepRef = useRef(runSweep);
    sweepRef.current = runSweep;

    /* ------------------------------------------------------------------ */
    /* Tick + wake detection                                               */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        if (!user?.id) return undefined;

        const evaluate = (reason) => {
            const at = Date.now();
            const gapMs = at - lastTickAtRef.current;
            lastTickAtRef.current = at;
            const nowDate = new Date(at);
            setNow(nowDate);
            sweepRef.current(nowDate, { isCatchUp: reason !== 'tick' || gapMs > WAKE_GAP_MS });
        };

        const interval = setInterval(() => evaluate('tick'), TICK_MS);

        // Background tabs get their intervals throttled and sleeping machines
        // freeze them entirely, so these events are what actually catch a gap.
        const onWake = () => {
            if (document.visibilityState === 'visible') evaluate('wake');
        };
        window.addEventListener('focus', onWake);
        document.addEventListener('visibilitychange', onWake);
        window.addEventListener('online', onWake);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onWake);
            document.removeEventListener('visibilitychange', onWake);
            window.removeEventListener('online', onWake);
        };
    }, [user?.id]);

    // Run once as soon as the day has loaded, so opening the app catches up
    // rather than waiting out a full tick.
    useEffect(() => {
        if (!user?.id || !hydrated) return;
        sweepRef.current(new Date(), { isCatchUp: true });
    }, [hydrated, user?.id]);

    // Hold the lease while this tab is alive so a second tab stays quiet.
    useEffect(() => {
        if (!user?.id) return undefined;
        const tabId = tabIdRef.current;
        claimNotificationLeadership(tabId);
        const interval = setInterval(() => claimNotificationLeadership(tabId), LEASE_REFRESH_MS);
        const onUnload = () => releaseNotificationLeadership(tabId);
        window.addEventListener('beforeunload', onUnload);
        return () => {
            clearInterval(interval);
            window.removeEventListener('beforeunload', onUnload);
            releaseNotificationLeadership(tabId);
        };
    }, [user?.id]);

    /* ------------------------------------------------------------------ */
    /* Timezone drift                                                      */
    /* ------------------------------------------------------------------ */

    /**
     * Reminders run on browser-local time, because that is the clock the user
     * is actually looking at. The server computes "today" from the stored IANA
     * zone instead - which defaults to UTC and is usually never set - so the
     * two disagree at day boundaries. Offer the one-click fix rather than
     * silently overwriting a deliberate choice.
     */
    useEffect(() => {
        if (!user?.id) return;
        const detected = detectTimezone();
        if (!detected || detected === user.timezone) return;

        const flagKey = `${TZ_PROMPT_PREFIX}:${user.id}`;
        try {
            if (localStorage.getItem(flagKey)) return;
            localStorage.setItem(flagKey, detected);
        } catch {
            return; // No storage means no way to ask only once - so don't ask.
        }

        pushToast({
            title: 'Your timezone looks out of date',
            body: `DayMap has you in ${user.timezone || 'UTC'}, but this device is on ${detected}.`,
            tone: 'muted',
            tag: 'daymap-timezone',
            actions: [{
                key: 'update',
                label: 'Update timezone',
                variant: 'primary',
                onClick: () => updateProfile({ timezone: detected }).catch(() => null)
            }]
        });
    }, [pushToast, updateProfile, user?.id, user?.timezone]);

    /* ------------------------------------------------------------------ */
    /* Surface for the bell and Settings                                   */
    /* ------------------------------------------------------------------ */

    const requestBrowserPermission = useCallback(async () => {
        if (!canUseBrowserNotifications) return 'unsupported';
        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            return result;
        } catch {
            setPermission('denied');
            return 'denied';
        }
    }, []);

    const markAllRead = useCallback(() => {
        persist({
            ...ledgerRef.current,
            entries: ledgerRef.current.entries.map((entry) => ({ ...entry, read: true }))
        });
    }, [persist]);

    const markRead = useCallback((ids) => {
        const idSet = new Set(ids);
        persist({
            ...ledgerRef.current,
            entries: ledgerRef.current.entries.map((entry) => (
                idSet.has(entry.id) ? { ...entry, read: true } : entry
            ))
        });
    }, [persist]);

    const upcoming = useMemo(
        () => collectUpcomingTriggers(dayItems, nowMinutes, prefs, firedKeys),
        [dayItems, firedKeys, nowMinutes, prefs]
    );

    const unreadCount = useMemo(
        () => ledger.entries.filter((entry) => !entry.read).length,
        [ledger.entries]
    );

    return {
        entries: ledger.entries,
        unreadCount,
        upcoming,
        dayItems,
        routineNameById,
        nowMinutes,
        prefs,
        permission,
        canUseBrowserNotifications,
        requestBrowserPermission,
        handleStatusUpdate,
        markRead,
        markAllRead,
        runSweep
    };
};

export default useNotificationEngine;
