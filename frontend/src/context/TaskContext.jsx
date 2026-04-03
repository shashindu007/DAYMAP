import React, { createContext, useContext, useState, useCallback } from 'react';
import taskService from '../services/taskService';

const TaskContext = createContext(null);

export const TaskProvider = ({ children }) => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchTasks = useCallback(async (filters = {}) => {
        try {
            setLoading(true);
            setError(null);
            const response = await taskService.getAllTasks(filters);
            setTasks(response.data.tasks);
            return response;
        } catch (error) {
            setError(error.message || 'Failed to fetch tasks');
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
            setTasks(response.data.tasks);
            return response;
        } catch (error) {
            setError(error.message || 'Failed to fetch today\'s tasks');
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
            setTasks(response.data.tasks);
            return response;
        } catch (error) {
            setError(error.message || 'Failed to fetch week\'s tasks');
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
            setError(error.message || 'Failed to fetch day schedule');
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
            setError(error.message || 'Failed to create day schedule');
            throw error;
        }
    };

    const createTask = async (taskData) => {
        try {
            setError(null);
            const response = await taskService.createTask(taskData);
            setTasks(prev => [...prev, response.data]);
            return response;
        } catch (error) {
            setError(error.message || 'Failed to create task');
            throw error;
        }
    };

    const updateTask = async (id, taskData) => {
        try {
            setError(null);
            const response = await taskService.updateTask(id, taskData);
            setTasks(prev => prev.map(task => 
                task.id === id ? response.data : task
            ));
            return response;
        } catch (error) {
            setError(error.message || 'Failed to update task');
            throw error;
        }
    };

    const deleteTask = async (id) => {
        try {
            setError(null);
            await taskService.deleteTask(id);
            setTasks(prev => prev.filter(task => task.id !== id));
        } catch (error) {
            setError(error.message || 'Failed to delete task');
            throw error;
        }
    };

    const completeTask = async (id) => {
        try {
            setError(null);
            const response = await taskService.completeTask(id);
            setTasks(prev => prev.map(task => 
                task.id === id ? response.data : task
            ));
            return response;
        } catch (error) {
            setError(error.message || 'Failed to complete task');
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
