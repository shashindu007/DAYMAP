import React, { createContext, useContext } from 'react';
import useNotificationEngine from '../hooks/useNotificationEngine';

const NotificationContext = createContext(null);

/**
 * Owns the single reminder engine for the whole app.
 *
 * Mounted above <Routes> for two reasons: a reminder must survive navigation,
 * and this provider is the one consumer that auto-fetches today - so the day
 * is loaded and refreshed no matter which page the user is sitting on.
 */
export const NotificationProvider = ({ children }) => {
    const engine = useNotificationEngine();

    return (
        <NotificationContext.Provider value={engine}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

export default NotificationContext;
