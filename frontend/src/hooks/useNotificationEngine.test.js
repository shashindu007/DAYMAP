import React from 'react';
// The project has no src/setupTests.js, so the matchers are imported here.
import '@testing-library/jest-dom';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import { NotificationProvider } from '../context/NotificationContext';
import { buildNotificationStorageKey } from '../utils/notificationStorage';

/**
 * Integration test for the reminder engine: does a real schedule task,
 * ticking past its lead window, actually produce a toast - and only once?
 *
 * The three data contexts and auth are stubbed so the test drives the engine
 * rather than the network.
 */

const USER_ID = 'user-1';
const pad = (n) => `${n}`.padStart(2, '0');

/** A schedule task starting `offsetMin` from now, lasting 60 minutes. */
const slotAt = (offsetMin, overrides = {}) => {
    const start = new Date(Date.now() + offsetMin * 60000);
    const end = new Date(start.getTime() + 60 * 60000);
    const ymd = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    return {
        id: 'task-1',
        title: 'Deep work',
        status: 'pending',
        scheduled_date: ymd,
        slot_start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}:00`,
        slot_end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}:00`,
        source: 'schedule',
        priority: 'medium',
        ...overrides
    };
};

let mockUser;
let mockScheduleTasks;

// taskService pulls in axios, which ships ESM that CRA's Jest will not
// transform. The engine never reaches it in these tests anyway.
jest.mock('../services/taskService', () => ({
    __esModule: true,
    default: { updateStatus: jest.fn().mockResolvedValue({ data: {} }) }
}));

jest.mock('../context/AuthContext', () => ({
    useAuth: () => ({ user: mockUser, updateProfile: jest.fn() })
}));

jest.mock('../context/ScheduleContext', () => ({
    useSchedule: () => ({
        scheduleByDate: global.__scheduleByDate,
        loading: false,
        error: null,
        fetchSchedule: jest.fn().mockResolvedValue(null),
        updateScheduleTaskStatus: jest.fn().mockResolvedValue(null),
        patchTaskFromRoutineItem: jest.fn()
    })
}));

jest.mock('../context/RoutineContext', () => ({
    useRoutine: () => ({
        dailyByDate: {},
        fetchDailyRoutine: jest.fn().mockResolvedValue(null),
        completeInstanceItem: jest.fn().mockResolvedValue(null),
        patchItemFromScheduleTask: jest.fn()
    })
}));

jest.mock('../context/TaskContext', () => ({
    useTasks: () => ({
        tasksByDate: {},
        fetchTasksForDate: jest.fn().mockResolvedValue(null),
        patchTaskInDate: jest.fn()
    })
}));

const renderEngine = () => render(
    <MemoryRouter>
        <ToastProvider>
            <NotificationProvider>
                <div>app</div>
            </NotificationProvider>
        </ToastProvider>
    </MemoryRouter>
);

const setDay = (tasks) => {
    const now = new Date();
    const ymd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    global.__scheduleByDate = { [ymd]: { tasks } };
};

beforeEach(() => {
    localStorage.clear();
    mockUser = {
        id: USER_ID,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        // Digest off by default here so it does not drown the assertions;
        // it gets its own test below.
        notification_preferences: { lead_minutes: 30, daily_digest: false, notify_on_start: false }
    };
    mockScheduleTasks = [];
    setDay(mockScheduleTasks);
});

describe('useNotificationEngine', () => {
    it('fires a pre-start toast for a task inside the lead window', async () => {
        setDay([slotAt(20)]);   // starts in 20 min, lead is 30
        renderEngine();

        expect(await screen.findByRole('status')).toBeInTheDocument();
        expect(screen.getByText(/Deep work starts in/i)).toBeInTheDocument();
    });

    it('stays silent for a task outside the lead window', async () => {
        setDay([slotAt(90)]);   // starts in 90 min
        renderEngine();

        await act(async () => { await Promise.resolve(); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('writes the delivery to the ledger so a remount does not re-fire', async () => {
        setDay([slotAt(20)]);
        const first = renderEngine();
        await screen.findByRole('status');

        const stored = JSON.parse(localStorage.getItem(buildNotificationStorageKey(USER_ID)));
        expect(stored.entries).toHaveLength(1);
        expect(stored.entries[0].key).toBe('pre_start:schedule:task-1');

        first.unmount();
        renderEngine();   // simulates a page reload

        await act(async () => { await Promise.resolve(); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('does not fire for a task the user already completed', async () => {
        setDay([slotAt(20, { status: 'completed' })]);
        renderEngine();

        await act(async () => { await Promise.resolve(); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('records but does not interrupt during quiet hours', async () => {
        mockUser.notification_preferences = {
            ...mockUser.notification_preferences,
            quiet_hours: { enabled: true, start: '00:00', end: '23:59' }
        };
        setDay([slotAt(20)]);
        renderEngine();

        await waitFor(() => {
            const stored = JSON.parse(localStorage.getItem(buildNotificationStorageKey(USER_ID)));
            expect(stored?.entries).toHaveLength(1);
        });

        const stored = JSON.parse(localStorage.getItem(buildNotificationStorageKey(USER_ID)));
        expect(stored.entries[0].delivery).toBe('suppressed');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('fires nothing at all when the master toggle is off', async () => {
        mockUser.notification_preferences = { ...mockUser.notification_preferences, enabled: false };
        setDay([slotAt(20)]);
        renderEngine();

        await act(async () => { await Promise.resolve(); });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(localStorage.getItem(buildNotificationStorageKey(USER_ID))).toBeNull();
    });

    it('delivers the morning digest once past its time', async () => {
        mockUser.notification_preferences = {
            lead_minutes: 0, notify_on_start: false, notify_on_end: false,
            daily_digest: true, digest_time: '00:01'
        };
        setDay([slotAt(120), slotAt(240, { id: 'task-2' })]);
        renderEngine();

        expect(await screen.findByText(/^Today: 2 tasks/)).toBeInTheDocument();
    });

    it('offers Mark done / Snooze actions on the end-of-task nudge', async () => {
        mockUser.notification_preferences = {
            lead_minutes: 0, notify_on_start: false, notify_on_end: true, daily_digest: false
        };
        // Started 90 min ago, so it ended 30 min ago... use a slot that ended
        // just now: start 60 min ago, 60 min long.
        setDay([slotAt(-60)]);
        renderEngine();

        expect(await screen.findByText(/Did you finish Deep work\?/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mark done' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: "Didn't do it" })).toBeInTheDocument();
    });

    it('lets a toast be dismissed', async () => {
        setDay([slotAt(20)]);
        renderEngine();
        await screen.findByRole('status');

        await act(async () => {
            await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
        });
        await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    });
});
