import api from './api';

const taskService = {
    /**
     * Get all tasks with optional filters
     */
    getAllTasks: async (filters = {}) => {
        const params = new URLSearchParams(filters).toString();
        return api.get(`/tasks?${params}`);
    },

    /**
     * Get single task by ID
     */
    getTask: async (id) => {
        return api.get(`/tasks/${id}`);
    },

    /**
     * Create a new task
     */
    createTask: async (taskData) => {
        return api.post('/tasks', taskData);
    },

    /**
     * Update task
     */
    updateTask: async (id, taskData) => {
        return api.put(`/tasks/${id}`, taskData);
    },

    /**
     * Delete task
     */
    deleteTask: async (id) => {
        return api.delete(`/tasks/${id}`);
    },

    /**
     * Mark task as complete
     */
    completeTask: async (id) => {
        return api.patch(`/tasks/${id}/complete`);
    },

    /**
     * Update task status
     */
    updateStatus: async (id, status) => {
        return api.patch(`/tasks/${id}/status`, { status });
    },

    /**
     * Get today's tasks
     */
    getTodayTasks: async () => {
        return api.get('/tasks/today');
    },

    /**
     * Get week's tasks
     */
    getWeekTasks: async () => {
        return api.get('/tasks/week');
    },

    /**
     * Get upcoming tasks
     */
    getUpcomingTasks: async () => {
        return api.get('/tasks/upcoming');
    },

    /**
     * Bulk delete tasks
     */
    bulkDelete: async (ids) => {
        return api.post('/tasks/bulk-delete', { ids });
    }
};

export default taskService;
