import React, { createContext, useContext, useState, useCallback } from 'react';
import taskService from '../services/taskService';

const TaskContext = createContext(null);

export const TaskProvider = ({ children }) => {
    const [tasks, setTasks] = useState([]);
    // Date-keyed cache kept alongside the flat `tasks` array, which every
    // fetch* helper overwrites wholesale. Today's Dashboard needs one day's
    // free-form tasks to survive a refetch triggered by another page.
    const [tasksByDate, setTasksByDate] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const resolveErrorMessage = (error, fallback) => (
        error?.errors?.[0]?.message || error?.message || fallback
    );

    const normalizeTasksResponse = (response) => {
        const data = response?.data ?? response;
        if (Array.isArray(data?.tasks)) return data.tasks;
        if (Array.isArray(response?.tasks)) return response.tasks;
        if (Array.isArray(data)) return data;
        return [];
    };

    const normalizeTaskResponse = (response) => {
        if (!response) return null;
        if (response?.data?.data) return response.data.data;
        if (response?.data) return response.data;
        if (response?.task) return response.task;
        return response;
    };

    const fetchTasks = useCallback(async (filters = {}) => {
        try {
            setLoading(true);
            setError(null);
            const response = await taskService.getAllTasks(filters);
            setTasks(normalizeTasksResponse(response));
            return response;
        } catch (error) {
            setError(resolveErrorMessage(error, 'Failed to fetch tasks'));
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchTodayTasks = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await taskService.getTodayTasks();
            setTasks(normalizeTasksResponse(response));
            return response;
        } catch (error) {
            setError(resolveErrorMessage(error, 'Failed to fetch today\'s tasks'));
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchWeekTasks = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await taskService.getWeekTasks();
            setTasks(normalizeTasksResponse(response));
            return response;
        } catch (error) {
            setError(resolveErrorMessage(error, 'Failed to fetch week\'s tasks'));
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);


    /**
     * Load one day's free-form tasks into the date-keyed cache.
     *
     * Uses the scheduled_date filter rather than GET /tasks/today, which
     * resolves "today" server-side from the user's timezone and can disagree
     * with the browser's date. This returns Task rows only - the API merges
     * schedule tasks only when both date_from and date_to are given - so it
     * never duplicates what ScheduleContext already holds.
     */
    const fetchTasksForDate = useCallback(async (date) => {
        if (!date) return [];
        try {
            setError(null);
            const response = await taskService.getAllTasks({ scheduled_date: date });
            const dayTasks = normalizeTasksResponse(response);
            setTasksByDate(prev => ({ ...prev, [date]: dayTasks }));
            return dayTasks;
        } catch (error) {
            setError(resolveErrorMessage(error, 'Failed to fetch tasks for date'));
            throw error;
        }
    }, []);

    /** Insert a task into the day cache without a refetch. */
    const addTaskToDate = useCallback((date, task) => {
        if (!date || !task) return;
        setTasksByDate(prev => {
            const existing = prev[date] || [];
            if (existing.some(entry => entry.id === task.id)) return prev;
            return { ...prev, [date]: [...existing, task] };
        });
    }, []);

    /** Patch a task already in the day cache (e.g. after a status change). */
    const patchTaskInDate = useCallback((date, task) => {
        if (!date || !task) return;
        setTasksByDate(prev => {
            const existing = prev[date];
            if (!existing) return prev;
            return {
                ...prev,
                [date]: existing.map(entry => (entry.id === task.id ? { ...entry, ...task } : entry))
            };
        });
    }, []);

    const createTask = async (taskData) => {
        try {
            setError(null);
            const response = await taskService.createTask(taskData);
            const createdTask = normalizeTaskResponse(response);
            if (createdTask) {
                setTasks(prev => [...prev, createdTask]);
                if (taskData?.scheduled_date) {
                    addTaskToDate(taskData.scheduled_date, createdTask);
                }
            }
            return response;
        } catch (error) {
            setError(resolveErrorMessage(error, 'Failed to create task'));
            throw error;
        }
    };

    const updateTask = async (id, taskData) => {
        const previousTasks = tasks;
        try {
            setError(null);
            setTasks(prev => prev.map(task => (
                task.id === id ? { ...task, ...taskData } : task
            )));
            const response = await taskService.updateTask(id, taskData);
            const updatedTask = normalizeTaskResponse(response);
            if (updatedTask) {
                setTasks(prev => prev.map(task => 
                    task.id === id ? updatedTask : task
                ));
            }
            return response;
        } catch (error) {
            setTasks(previousTasks);
            setError(resolveErrorMessage(error, 'Failed to update task'));
            throw error;
        }
    };

    const deleteTask = async (id) => {
        const previousTasks = tasks;
        try {
            setError(null);
            setTasks(prev => prev.filter(task => task.id !== id));
            await taskService.deleteTask(id);
            return true;
        } catch (error) {
            setTasks(previousTasks);
            setError(resolveErrorMessage(error, 'Failed to delete task'));
            throw error;
        }
    };

    const completeTask = async (id) => {
        try {
            setError(null);
            setTasks(prev => prev.map(task =>
                task.id === id ? { ...task, status: 'completed' } : task
            ));
            const response = await taskService.completeTask(id);
            const updatedTask = normalizeTaskResponse(response);
            if (updatedTask) {
                setTasks(prev => prev.map(task => 
                    task.id === id ? updatedTask : task
                ));
            }
            return response;
        } catch (error) {
            setError(resolveErrorMessage(error, 'Failed to complete task'));
            throw error;
        }
    };

    const value = {
        tasks,
        tasksByDate,
        loading,
        error,
        fetchTasks,
        fetchTodayTasks,
        fetchWeekTasks,
        fetchTasksForDate,
        addTaskToDate,
        patchTaskInDate,
        createTask,
        updateTask,
        deleteTask,
        completeTask
    };

    return (
        <TaskContext.Provider value={value}>
            {children}
        </TaskContext.Provider>
    );
};

export const useTasks = () => {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error('useTasks must be used within a TaskProvider');
    }
    return context;
};

export default TaskContext;
