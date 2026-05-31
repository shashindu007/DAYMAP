import api from './api';

const routineService = {
    /**
     * Get all routines
     */
    getAllRoutines: async (activeOnly = false) => {
        const params = activeOnly ? '?active_only=true' : '';
        return api.get(`/routines${params}`);
    },

    /**
     * Get single routine
     */
    getRoutine: async (id) => {
        return api.get(`/routines/${id}`);
    },

    /**
     * Create new routine
     */
    createRoutine: async (routineData) => {
        return api.post('/routines', routineData);
    },

    /**
     * Update routine
     */
    updateRoutine: async (id, routineData) => {
        return api.put(`/routines/${id}`, routineData);
    },

    /**
     * Delete routine
     */
    deleteRoutine: async (id) => {
        return api.delete(`/routines/${id}`);
    },

    /**
     * Toggle routine active status
     */
    toggleActive: async (id) => {
        return api.patch(`/routines/${id}/activate`);
    },

    /**
     * Apply routine to create tasks
     */
    applyRoutine: async (id, applyData) => {
        return api.post(`/routines/${id}/apply`, applyData);
    },

    getDailyRoutine: async (date) => {
        return api.get(`/routines/daily/${date}`);
    },

    updateRoutineInstanceItem: async (instanceId, itemId, updates) => {
        return api.patch(`/routines/instances/${instanceId}/items/${itemId}`, updates);
    },

    completeRoutineInstanceItem: async (instanceId, itemId, status = 'completed') => {
        return api.patch(`/routines/instances/${instanceId}/items/${itemId}/complete`, { status });
    }
};

export default routineService;
