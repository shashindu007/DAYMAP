import React, { createContext, useContext } from 'react';
import useFocusEngine from '../hooks/useFocusEngine';

const FocusContext = createContext(null);

/**
 * Owns the single focus session for the whole app.
 *
 * Mounted above <Routes> so a running sprint survives navigation between
 * /today and /focus - both render the same FocusSessionPanel against this
 * one engine, so there is no second timer and no double-logged session.
 */
export const FocusProvider = ({ children }) => {
    const engine = useFocusEngine();

    return (
        <FocusContext.Provider value={engine}>
            {children}
        </FocusContext.Provider>
    );
};

export const useFocus = () => {
    const context = useContext(FocusContext);
    if (!context) {
        throw new Error('useFocus must be used within a FocusProvider');
    }
    return context;
};

export default FocusContext;
