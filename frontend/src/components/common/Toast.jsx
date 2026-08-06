import React, { useCallback, useEffect, useRef, useState } from 'react';
import './Toast.css';

/**
 * One toast card.
 *
 * The auto-dismiss timer pauses while the pointer or keyboard focus is inside
 * the card - otherwise a toast can expire mid-read, or mid-click on its own
 * action button.
 */
const ToastCard = ({ toast, onDismiss }) => {
    const { id, title, body, tone, actions, duration } = toast;
    const [paused, setPaused] = useState(false);
    const timerRef = useRef(null);

    const dismiss = useCallback(() => onDismiss(id), [id, onDismiss]);

    useEffect(() => {
        if (!duration || paused) return undefined;
        timerRef.current = setTimeout(dismiss, duration);
        return () => clearTimeout(timerRef.current);
    }, [dismiss, duration, paused]);

    return (
        <div
            className={`toast toast--${tone}`}
            role="status"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
        >
            <div className="toast-body">
                <p className="toast-title">{title}</p>
                {body && <p className="toast-text">{body}</p>}

                {actions.length > 0 && (
                    <div className="toast-actions">
                        {actions.map((action) => (
                            <button
                                key={action.key}
                                type="button"
                                className={`btn btn-sm btn-${action.variant || 'secondary'}`}
                                onClick={() => {
                                    action.onClick?.();
                                    // Every action answers the toast's question,
                                    // so the card has served its purpose.
                                    if (action.keepOpen !== true) dismiss();
                                }}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button
                type="button"
                className="toast-dismiss"
                onClick={dismiss}
                aria-label="Dismiss notification"
            >
                <span aria-hidden>✕</span>
            </button>
        </div>
    );
};

/**
 * Fixed stack in the bottom-right corner.
 *
 * aria-live is `polite`, never `assertive`: a reminder is not an emergency and
 * assertive would cut a screen reader off mid-sentence.
 */
const ToastViewport = ({ toasts, onDismiss }) => {
    // Escape closes the most recent toast, mirroring ConfirmDialog's handler.
    useEffect(() => {
        if (toasts.length === 0) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onDismiss(toasts[toasts.length - 1].id);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onDismiss, toasts]);

    if (toasts.length === 0) return null;

    return (
        <div
            className="toast-viewport"
            role="region"
            aria-label="Notifications"
            aria-live="polite"
            aria-atomic="false"
        >
            {toasts.map((toast) => (
                <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
            ))}
        </div>
    );
};

export default ToastViewport;
export { ToastCard };
