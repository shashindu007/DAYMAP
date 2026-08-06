import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { isResolvedStatus } from '../../utils/taskStatus';
import { describeUpcoming } from '../../utils/notificationRules';
import './NotificationBell.css';

/** A mis-click should not silently clear the whole badge. */
const READ_DWELL_MS = 600;

const formatFiredAt = (timestamp) => (
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
);

const DELIVERY_NOTES = {
    suppressed: 'Not shown — quiet hours or already passed',
    'rolled-up': 'Grouped into a summary'
};

const NotificationPanel = ({ onClose, bellRef }) => {
    const {
        entries,
        upcoming,
        dayItems,
        permission,
        canUseBrowserNotifications,
        prefs,
        requestBrowserPermission,
        handleStatusUpdate,
        markRead,
        markAllRead
    } = useNotifications();

    const panelRef = useRef(null);

    // Escape and click-outside, mirroring ConfirmDialog's handler. This is a
    // popover, not a modal: no overlay and no focus trap, because it must
    // never block the app behind it.
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
                bellRef.current?.focus();
            }
        };
        const onPointerDown = (event) => {
            if (panelRef.current?.contains(event.target)) return;
            if (bellRef.current?.contains(event.target)) return;
            onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('mousedown', onPointerDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('mousedown', onPointerDown);
        };
    }, [bellRef, onClose]);

    const unreadIds = useMemo(
        () => entries.filter((entry) => !entry.read).map((entry) => entry.id),
        [entries]
    );

    useEffect(() => {
        if (unreadIds.length === 0) return undefined;
        const timer = setTimeout(() => markRead(unreadIds), READ_DWELL_MS);
        return () => clearTimeout(timer);
    }, [markRead, unreadIds]);

    /** Resolve against the live item so an edit since firing is reflected. */
    const liveItemFor = useCallback((entry) => (
        entry.itemKey ? dayItems.find((item) => item.key === entry.itemKey) : null
    ), [dayItems]);

    const needsAnswer = useMemo(() => (
        entries.filter((entry) => {
            if (entry.type !== 'end') return false;
            const item = liveItemFor(entry);
            return Boolean(item) && !isResolvedStatus(item.status);
        })
    ), [entries, liveItemFor]);

    const history = useMemo(
        () => [...entries].sort((a, b) => b.firedAt - a.firedAt),
        [entries]
    );

    const showEnablePrompt = canUseBrowserNotifications
        && prefs.browser_push
        && permission === 'default';

    return (
        <div
            className="notif-panel"
            role="dialog"
            aria-label="Notifications"
            ref={panelRef}
        >
            <div className="notif-panel-header">
                <h2>Notifications</h2>
                {entries.length > 0 && (
                    <button type="button" className="notif-link" onClick={markAllRead}>
                        Mark all read
                    </button>
                )}
            </div>

            {showEnablePrompt && (
                <div className="notif-enable">
                    <p>Desktop notifications are off. Turn them on to get reminders outside this tab.</p>
                    <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={requestBrowserPermission}
                    >
                        Enable
                    </button>
                </div>
            )}

            <div className="notif-panel-body">
                {needsAnswer.length > 0 && (
                    <section className="notif-section">
                        <h3>Needs your answer</h3>
                        {needsAnswer.map((entry) => {
                            const item = liveItemFor(entry);
                            return (
                                <div key={entry.id} className="notif-row notif-row--action">
                                    <p className="notif-row-title">{entry.title}</p>
                                    <p className="notif-row-meta">
                                        {[entry.startLabel && `${entry.startLabel}–${entry.endLabel}`, item?.category]
                                            .filter(Boolean).join(' · ')}
                                    </p>
                                    <div className="notif-row-actions">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-primary"
                                            onClick={() => handleStatusUpdate(item, 'completed')}
                                        >
                                            Mark done
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            onClick={() => handleStatusUpdate(item, 'missed')}
                                        >
                                            Didn&apos;t do it
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </section>
                )}

                <section className="notif-section">
                    <h3>Earlier today</h3>
                    {history.length === 0 ? (
                        <p className="notif-empty">Nothing yet today.</p>
                    ) : history.map((entry) => {
                        const item = liveItemFor(entry);
                        const note = DELIVERY_NOTES[entry.delivery];
                        return (
                            <div key={entry.id} className={`notif-row ${entry.read ? '' : 'is-unread'}`}>
                                <p className="notif-row-title">{entry.title}</p>
                                {entry.body && <p className="notif-row-body">{entry.body}</p>}
                                <p className="notif-row-meta">
                                    {[
                                        formatFiredAt(entry.firedAt),
                                        item?.priority && item.priority !== 'medium' ? `${item.priority} priority` : null,
                                        note
                                    ].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                        );
                    })}
                </section>

                {upcoming.length > 0 && (
                    <section className="notif-section">
                        <h3>Coming up</h3>
                        {upcoming.map((trigger) => (
                            <p key={trigger.key} className="notif-upcoming">
                                {describeUpcoming(trigger)}
                            </p>
                        ))}
                    </section>
                )}
            </div>
        </div>
    );
};

/**
 * The notification centre entry point, rendered in the app header beside the
 * other icon buttons. Everything it shows comes from the engine's per-day
 * ledger, so it survives a reload and empties itself at midnight.
 */
const NotificationBell = () => {
    const { unreadCount } = useNotifications();
    const [open, setOpen] = useState(false);
    const bellRef = useRef(null);

    return (
        <div className="notif-bell-wrap">
            <button
                ref={bellRef}
                type="button"
                className="icon-btn notif-bell"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                aria-expanded={open}
                aria-haspopup="dialog"
                onClick={() => setOpen((value) => !value)}
            >
                <span aria-hidden>🔔</span>
                {unreadCount > 0 && (
                    <span className="notif-badge" aria-hidden>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && <NotificationPanel onClose={() => setOpen(false)} bellRef={bellRef} />}
        </div>
    );
};

export default NotificationBell;
