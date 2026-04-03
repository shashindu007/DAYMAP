import api from './api';

const taskService = {
    /**
     * Get all tasks with optional filters
     */
    getAllTasks: async (filters = {}) => {
        try {
            const params = new URLSearchParams(filters).toString();
            const response = await api.get(`/tasks?${params}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get single task by ID
     */
    getTask: async (id) => {
        try {
            const response = await api.get(`/tasks/${id}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Create a new task
     */
    createTask: async (taskData) => {
        try {
            const response = await api.post('/tasks', taskData);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Update task
     */
    updateTask: async (id, taskData) => {
        try {
            const response = await api.put(`/tasks/${id}`, taskData);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Delete task
     */
    deleteTask: async (id) => {
        try {
            const response = await api.delete(`/tasks/${id}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Mark task as complete
     */
    completeTask: async (id) => {
        try {
            const response = await api.patch(`/tasks/${id}/complete`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Update task status
     */
    updateStatus: async (id, status) => {
        try {
            const response = await api.patch(`/tasks/${id}/status`, { status });
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get today's tasks
     */
    getTodayTasks: async () => {
        try {
            const response = await api.get('/tasks/today');
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get week's tasks
     */
    getWeekTasks: async () => {
        try {
            const response = await api.get('/tasks/week');
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get upcoming tasks
     */
    getUpcomingTasks: async () => {
        try {
            const response = await api.get('/tasks/upcoming');
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get full-day schedule for a date
     */
    getDaySchedule: async (date) => {
        try {
            const response = await api.get(`/tasks/day-schedule/${date}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Create full-day schedule with multiple task slots
     */
    createDaySchedule: async (scheduleData) => {
        try {
            const response = await api.post('/tasks/day-schedule', scheduleData);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Bulk delete tasks
     */
    bulkDelete: async (ids) => {
        try {
            const response = await api.post('/tasks/bulk-delete', { ids });
            return response;
        } catch (error) {
            throw error;
        }
    }
};

export default taskService;
