import { collectDueTriggers, collectUpcomingTriggers, describeTrigger } from './notificationRules';
import { summarizeDay } from './dayItems';
import { DEFAULT_NOTIFICATION_PREFS, isWithinQuietHours } from './notificationPrefs';

const item = (overrides = {}) => ({
    key: `schedule:${overrides.id || 'a'}`,
    id: overrides.id || 'a',
    kind: 'schedule',
    title: 'Deep work',
    status: 'pending',
    startMinutes: 540,          // 09:00
    endMinutes: 630,            // 10:30
    startLabel: '09:00',
    endLabel: '10:30',
    category: null,
    priority: 'medium',
    isRoutine: false,
    ...overrides
});

const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
const noFired = new Set();
const typesOf = (triggers) => triggers.map((trigger) => trigger.type).sort();

describe('collectDueTriggers', () => {
    it('fires the pre-start reminder inside the lead window', () => {
        // 08:35, task at 09:00, lead 30 -> due since 08:30
        expect(typesOf(collectDueTriggers([item()], 515, prefs, noFired))).toContain('pre_start');
    });

    it('stays silent before the lead window opens', () => {
        // 08:15 is still outside a 30-minute lead
        expect(collectDueTriggers([item()], 495, prefs, noFired)).toHaveLength(0);
    });

    it('late-fires when the app is opened inside the window', () => {
        // Opening at 08:55 for a 09:00 task must still warn, and say "in 5 min"
        const due = collectDueTriggers([item()], 535, prefs, noFired);
        const preStart = due.find((trigger) => trigger.type === 'pre_start');
        expect(preStart).toBeDefined();
        expect(describeTrigger(preStart, 535).title).toBe('Deep work starts in 5 min');
    });

    it('stops the pre-start reminder once the task has begun', () => {
        expect(typesOf(collectDueTriggers([item()], 545, prefs, noFired))).not.toContain('pre_start');
    });

    it('fires the end nudge at the end time', () => {
        expect(typesOf(collectDueTriggers([item()], 630, prefs, noFired))).toContain('end');
    });

    it('drops the end nudge once it is stale beyond the grace window', () => {
        // 17:00, hours after a 10:30 finish
        expect(collectDueTriggers([item()], 1020, prefs, noFired)).toHaveLength(0);
    });

    it('never nags about resolved work', () => {
        ['completed', 'missed', 'cancelled'].forEach((status) => {
            expect(collectDueTriggers([item({ status })], 630, prefs, noFired)).toHaveLength(0);
        });
    });

    it('ignores untimed anytime tasks', () => {
        const anytime = item({ startMinutes: null, endMinutes: null, startLabel: '' });
        expect(collectDueTriggers([anytime], 630, prefs, noFired)).toHaveLength(0);
    });

    it('does not re-fire a trigger already in the ledger', () => {
        const fired = new Set(['pre_start:schedule:a']);
        expect(typesOf(collectDueTriggers([item()], 515, prefs, fired))).not.toContain('pre_start');
    });

    it('re-arms a snoozed trigger only once the snooze expires', () => {
        const fired = new Set(['pre_start:schedule:a']);
        const snoozes = { 'pre_start:schedule:a': 520 };
        expect(collectDueTriggers([item()], 515, prefs, fired, snoozes)).toHaveLength(0);
        expect(typesOf(collectDueTriggers([item()], 521, prefs, fired, snoozes))).toContain('pre_start');
    });

    it('honours the notify_on_start toggle', () => {
        const off = { ...prefs, notify_on_start: false };
        expect(typesOf(collectDueTriggers([item()], 540, off, noFired))).not.toContain('start');
        expect(typesOf(collectDueTriggers([item()], 540, prefs, noFired))).toContain('start');
    });

    it('honours lead_minutes: 0 as "no early reminder"', () => {
        const none = { ...prefs, lead_minutes: 0 };
        expect(typesOf(collectDueTriggers([item()], 515, none, noFired))).not.toContain('pre_start');
    });
});

describe('collectUpcomingTriggers', () => {
    it('lists only triggers still ahead, in time order', () => {
        const upcoming = collectUpcomingTriggers([item()], 480, prefs, noFired);
        expect(upcoming.map((trigger) => trigger.dueMinutes)).toEqual([510, 540, 630]);
    });
});

describe('isWithinQuietHours', () => {
    const quiet = { enabled: true, start: '22:00', end: '07:00' };

    it('covers a window that wraps past midnight', () => {
        expect(isWithinQuietHours(1350, quiet)).toBe(true);   // 22:30
        expect(isWithinQuietHours(120, quiet)).toBe(true);    // 02:00
        expect(isWithinQuietHours(600, quiet)).toBe(false);   // 10:00
    });

    it('covers a same-day window', () => {
        const midday = { enabled: true, start: '12:00', end: '13:00' };
        expect(isWithinQuietHours(750, midday)).toBe(true);   // 12:30
        expect(isWithinQuietHours(660, midday)).toBe(false);  // 11:00
    });

    it('is off when disabled', () => {
        expect(isWithinQuietHours(1350, { ...quiet, enabled: false })).toBe(false);
    });
});

describe('summarizeDay', () => {
    it('totals scheduled span and finds the first thing up', () => {
        const items = [
            item({ id: 'a' }),                                                   // 09:00-10:30
            item({ id: 'b', startMinutes: 660, endMinutes: 720, startLabel: '11:00' }), // 11:00-12:00
            item({ id: 'c', startMinutes: null, endMinutes: null })              // anytime
        ];
        const summary = summarizeDay(items, 480);
        expect(summary.total).toBe(3);
        expect(summary.scheduledMinutes).toBe(150);
        expect(summary.scheduledLabel).toBe('2h 30m');
        expect(summary.anytime).toBe(1);
        expect(summary.firstUp.startLabel).toBe('09:00');
    });
});
