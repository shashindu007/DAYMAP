import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import scheduleService from '../services/scheduleService';
import { toScheduleTaskStatus } from '../utils/taskStatus';

const ScheduleContext = createContext(null);

export const ScheduleProvider = ({ children }) => {
    const [scheduleByDate, setScheduleByDate] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const resolveErrorMessage = (err, fallback) => (
        err?.errors?.[0]?.message || err?.message || fallback
    );

    const upsertScheduleState = useCallback((date, scheduleData) => {
        setScheduleByDate((prev) => ({
            ...prev,
            [date]: scheduleData
        }));
    }, []);

    const fetchSchedule = useCallback(async (date) => {
        try {
            setLoading(true);
            setError(null);
            const response = await scheduleService.getScheduleByDate(date);
            const data = response?.data || response?.data?.data || response;
            if (data) {
                upsertScheduleState(date, data);
            }
            return data;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to fetch schedule'));
            throw err;
        } finally {
            setLoading(false);
        }
    }, [upsertScheduleState]);

    const saveSchedule = useCallback(async (date, slots, replaceExisting = true) => {
        try {
            setLoading(true);
            setError(null);
            const response = await scheduleService.saveSchedule({
                date,
                slots,
                replaceExisting
            });
            const data = response?.data || response?.data?.data || response;
            if (data) {
                upsertScheduleState(date, data);
            }
            return data;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to save schedule'));
            throw err;
        } finally {
            setLoading(false);
        }
    }, [upsertScheduleState]);

    const replaceSchedule = useCallback(async (date, slots) => {
        try {
            setLoading(true);
            setError(null);
            const response = await scheduleService.replaceSchedule(date, { slots });
            const data = response?.data || response?.data?.data || response;
            if (data) {
                upsertScheduleState(date, data);
            }
            return data;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to update schedule'));
            throw err;
        } finally {
            setLoading(false);
        }
    }, [upsertScheduleState]);

    const updateScheduleTaskStatus = useCallback(async (taskId, status) => {
        try {
            setError(null);
            const response = await scheduleService.updateScheduleTaskStatus(taskId, status);
            const updated = response?.data || response?.data?.data || response;
            if (updated) {
                setScheduleByDate((prev) => {
                    const next = { ...prev };
                    Object.keys(next).forEach((dateKey) => {
                        const tasks = next[dateKey]?.tasks || [];
                        const updatedTasks = tasks.map((task) =>
                            task.id === updated.id ? updated : task
                        );
                        next[dateKey] = { ...next[dateKey], tasks: updatedTasks };
                    });
                    return next;
                });
            }
            return updated;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to update status'));
            throw err;
        }
    }, []);

    const updateScheduleTask = useCallback(async (taskId, updates) => {
        try {
            setError(null);
            const response = await scheduleService.updateScheduleTask(taskId, updates);
            const updated = response?.data || response?.data?.data || response;
            if (updated) {
                setScheduleByDate((prev) => {
                    const next = { ...prev };
                    Object.keys(next).forEach((dateKey) => {
                        const tasks = next[dateKey]?.tasks || [];
                        const updatedTasks = tasks.map((task) =>
                            task.id === updated.id ? updated : task
                        );
                        next[dateKey] = { ...next[dateKey], tasks: updatedTasks };
                    });
                    return next;
                });
            }
            return updated;
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to update schedule task'));
            throw err;
        }
    }, []);

    const deleteScheduleTask = useCallback(async (taskId) => {
        try {
            setError(null);
            await scheduleService.deleteScheduleTask(taskId);
            setScheduleByDate((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((dateKey) => {
                    const tasks = next[dateKey]?.tasks || [];
                    next[dateKey] = {
                        ...next[dateKey],
                        tasks: tasks.filter((task) => task.id !== taskId)
                    };
                });
                return next;
            });
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to delete schedule task'));
            throw err;
        }
    }, []);

    /**
     * Reflect a routine item's new status onto the schedule task it was
     * materialized into. The server already writes both sides; this keeps the
     * two client caches from drifting until a reload.
     */
    const patchTaskFromRoutineItem = useCallback((date, item) => {
        if (!date || !item?.scheduled_task_id) return;
        const nextStatus = toScheduleTaskStatus(item.status);
        setScheduleByDate((prev) => {
            const day = prev[date];
            if (!day?.tasks) return prev;
            return {
                ...prev,
                [date]: {
                    ...day,
                    tasks: day.tasks.map((task) => (
                        task.id === item.scheduled_task_id
                            ? { ...task, status: nextStatus }
                            : task
                    ))
                }
            };
        });
    }, []);

    const fetchScheduleRange = useCallback(async (startDate, endDate) => {
        try {
            setError(null);
            const response = await scheduleService.getScheduleRange(startDate, endDate);
            const data = response?.data || response?.data?.data || response;
            return data?.tasks || [];
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to fetch schedule range'));
            throw err;
        }
    }, []);

    const value = useMemo(() => ({
        scheduleByDate,
        loading,
        error,
        fetchSchedule,
        saveSchedule,
        replaceSchedule,
        updateScheduleTaskStatus,
        updateScheduleTask,
        deleteScheduleTask,
        fetchScheduleRange,
        patchTaskFromRoutineItem
    }), [
        scheduleByDate,
        loading,
        error,
        fetchSchedule,
        saveSchedule,
        replaceSchedule,
        updateScheduleTaskStatus,
        updateScheduleTask,
        deleteScheduleTask,
        fetchScheduleRange,
        patchTaskFromRoutineItem
    ]);

    return (
        <ScheduleContext.Provider value={value}>
            {children}
        </ScheduleContext.Provider>
    );
};

export const useSchedule = () => {
    const context = useContext(ScheduleContext);
    if (!context) {
        throw new Error('useSchedule must be used within a ScheduleProvider');
    }
    return context;
};

export default ScheduleContext;
