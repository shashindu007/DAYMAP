import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ToastViewport from '../components/common/Toast';

const ToastContext = createContext(null);

/** More than three stacked cards stops being information and starts being a wall. */
const MAX_VISIBLE = 3;
const DEFAULT_DURATION_MS = 8000;

/**
 * The app's transient feedback channel.
 *
 * Before this, the only way to say anything to the user was an inline
 * `.alert` div owned by whichever page was mounted - which meant background
 * events (a reminder firing, a status write failing elsewhere) had nowhere to
 * surface. The viewport renders as a sibling of children so it works on every
 * route, signed in or not.
 */
export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const pushToast = useCallback(({
        title,
        body = '',
        tone = 'info',
        actions = [],
        duration,
        tag = null
    }) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        setToasts((prev) => {
            // `tag` lets a re-fired notification replace its predecessor
            // rather than stacking a near-duplicate beside it.
            const deduped = tag ? prev.filter((toast) => toast.tag !== tag) : prev;
            return [...deduped, {
                id,
                title,
                body,
                tone,
                actions,
                tag,
                // A toast that asks a question must not vanish before it is
                // answered, so anything with actions is manual-dismiss only.
                duration: duration === undefined
                    ? (actions.length > 0 ? null : DEFAULT_DURATION_MS)
                    : duration
            }];
        });

        return id;
    }, []);

    const clearToasts = useCallback(() => setToasts([]), []);

    const value = useMemo(
        () => ({ pushToast, dismissToast, clearToasts }),
        [clearToasts, dismissToast, pushToast]
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastViewport toasts={toasts.slice(0, MAX_VISIBLE)} onDismiss={dismissToast} />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export default ToastContext;
