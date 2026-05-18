import React, { createContext, useContext, useState, useCallback } from 'react';
import taskService from '../services/taskService';

const TaskContext = createContext(null);

export const TaskProvider = ({ children }) => {
    const [tasks, setTasks] = useState([]);
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

    const fetchDaySchedule = useCallback(async (date) => {
        try {
            setLoading(true);
            setError(null);
            const response = await taskService.getDaySchedule(date);
            return response;
        } catch (error) {
            setError(resolveErrorMessage(error, 'Failed to fetch day schedule'));
            throw error;
        } finally {
            setLoading(false);
        }
    }, []);

    const createDaySchedule = async (scheduleData) => {
        try {
            setError(null);
            const response = await taskService.createDaySchedule(scheduleData);
            await fetchTasks();
            return response;
        } catch (error) {
            setError(resolveErrorMessage(error, 'Failed to create day schedule'));
            throw error;
        }
    };

    const createTask = async (taskData) => {
        try {
            setError(null);
            const response = await taskService.createTask(taskData);
            const createdTask = normalizeTaskResponse(response);
            if (createdTask) {
                setTasks(prev => [...prev, createdTask]);
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
        loading,
        error,
        fetchTasks,
        fetchTodayTasks,
        fetchWeekTasks,
        fetchDaySchedule,
        createTask,
        createDaySchedule,
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
