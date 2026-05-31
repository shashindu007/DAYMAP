import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import routineService from '../services/routineService';

const RoutineContext = createContext(null);

export const RoutineProvider = ({ children }) => {
    const [templates, setTemplates] = useState([]);
    const [dailyByDate, setDailyByDate] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const resolveErrorMessage = (err, fallback) => (
        err?.errors?.[0]?.message || err?.message || fallback
    );

    const fetchTemplates = useCallback(async (activeOnly = false) => {
        try {
            setLoading(true);
            setError(null);
            const response = await routineService.getAllRoutines(activeOnly);
            const data = response?.data || response?.data?.data || response;
            const routineList = data?.routines || [];
            setTemplates(routineList);
            return routineList;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to load routines'));
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const createTemplate = useCallback(async (payload) => {
        try {
            setError(null);
            const response = await routineService.createRoutine(payload);
            const data = response?.data || response?.data?.data || response;
            if (data) {
                setTemplates((prev) => [data, ...prev]);
            }
            return data;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to create routine'));
            throw err;
        }
    }, []);

    const updateTemplate = useCallback(async (id, payload) => {
        try {
            setError(null);
            const response = await routineService.updateRoutine(id, payload);
            const data = response?.data || response?.data?.data || response;
            if (data) {
                setTemplates((prev) => prev.map((item) => (item.id === id ? data : item)));
            }
            return data;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to update routine'));
            throw err;
        }
    }, []);

    const deleteTemplate = useCallback(async (id) => {
        try {
            setError(null);
            await routineService.deleteRoutine(id);
            setTemplates((prev) => prev.filter((item) => item.id !== id));
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to delete routine'));
            throw err;
        }
    }, []);

    const fetchDailyRoutine = useCallback(async (date) => {
        try {
            setError(null);
            const response = await routineService.getDailyRoutine(date);
            const data = response?.data || response?.data?.data || response;
            if (data) {
                setDailyByDate((prev) => ({
                    ...prev,
                    [date]: data
                }));
            }
            return data;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to load daily routine'));
            throw err;
        }
    }, []);

    const updateInstanceItem = useCallback(async (instanceId, itemId, updates) => {
        try {
            setError(null);
            const response = await routineService.updateRoutineInstanceItem(instanceId, itemId, updates);
            const data = response?.data || response?.data?.data || response;
            if (data?.date) {
                setDailyByDate((prev) => {
                    const existing = prev[data.date] || {};
                    const routines = Array.isArray(existing.routines) ? existing.routines : [];
                    const updatedRoutines = routines.some((entry) => entry.id === data.id)
                        ? routines.map((entry) => (entry.id === data.id ? data : entry))
                        : [...routines, data];
                    return {
                        ...prev,
                        [data.date]: {
                            ...existing,
                            routines: updatedRoutines
                        }
                    };
                });
            }
            return data;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to update routine item'));
            throw err;
        }
    }, []);

    const completeInstanceItem = useCallback(async (instanceId, itemId, status = 'completed') => {
        try {
            setError(null);
            const response = await routineService.completeRoutineInstanceItem(instanceId, itemId, status);
            const data = response?.data || response?.data?.data || response;
            if (data?.date) {
                setDailyByDate((prev) => {
                    const existing = prev[data.date] || {};
                    const routines = Array.isArray(existing.routines) ? existing.routines : [];
                    const updatedRoutines = routines.some((entry) => entry.id === data.id)
                        ? routines.map((entry) => (entry.id === data.id ? data : entry))
                        : [...routines, data];
                    return {
                        ...prev,
                        [data.date]: {
                            ...existing,
                            routines: updatedRoutines
                        }
                    };
                });
            }
            return data;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to update routine item'));
            throw err;
        }
    }, []);

    const value = useMemo(() => ({
        templates,
        dailyByDate,
        loading,
        error,
        fetchTemplates,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        fetchDailyRoutine,
        updateInstanceItem,
        completeInstanceItem
    }), [
        templates,
        dailyByDate,
        loading,
        error,
        fetchTemplates,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        fetchDailyRoutine,
        updateInstanceItem,
        completeInstanceItem
    ]);

    return (
        <RoutineContext.Provider value={value}>
            {children}
        </RoutineContext.Provider>
    );
};

export const useRoutine = () => {
    const context = useContext(RoutineContext);
    if (!context) {
        throw new Error('useRoutine must be used within a RoutineProvider');
    }
    return context;
};

export default RoutineContext;
