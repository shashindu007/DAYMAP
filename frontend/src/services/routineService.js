import api from './api';

const routineService = {
    /**
     * Get all routines
     */
    getAllRoutines: async (activeOnly = false) => {
        try {
            const params = activeOnly ? '?active_only=true' : '';
            const response = await api.get(`/routines${params}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get single routine
     */
    getRoutine: async (id) => {
        try {
            const response = await api.get(`/routines/${id}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Create new routine
     */
    createRoutine: async (routineData) => {
        try {
            const response = await api.post('/routines', routineData);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Update routine
     */
    updateRoutine: async (id, routineData) => {
        try {
            const response = await api.put(`/routines/${id}`, routineData);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Delete routine
     */
    deleteRoutine: async (id) => {
        try {
            const response = await api.delete(`/routines/${id}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Toggle routine active status
     */
    toggleActive: async (id) => {
        try {
            const response = await api.patch(`/routines/${id}/activate`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Apply routine to create tasks
     */
    applyRoutine: async (id, applyData) => {
        try {
            const response = await api.post(`/routines/${id}/apply`, applyData);
            return response;
        } catch (error) {
            throw error;
        }
    }
};

export default routineService;
