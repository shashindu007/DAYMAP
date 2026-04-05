import api from './api';

const analyticsService = {
    /**
     * Get daily analytics
     */
    getDailyAnalytics: async (date) => {
        try {
            const response = await api.get(`/analytics/daily/${date}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get weekly analytics
     */
    getWeeklyAnalytics: async (startDate, endDate) => {
        try {
            const params = startDate && endDate
                ? `?start_date=${startDate}&end_date=${endDate}`
                : '';
            const response = await api.get(`/analytics/weekly${params}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get monthly analytics
     */
    getMonthlyAnalytics: async (year, month) => {
        try {
            const params = year && month ? `?year=${year}&month=${month}` : '';
            const response = await api.get(`/analytics/monthly${params}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get analytics summary
     */
    getSummary: async () => {
        try {
            const response = await api.get('/analytics/summary');
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get productivity trends
     */
    getTrends: async (days = 30) => {
        try {
            const response = await api.get(`/analytics/trends?days=${days}`);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Record completed focus session
     */
    logFocusSession: async (sessionData) => {
        try {
            const response = await api.post('/analytics/focus-session', sessionData);
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get focus patterns for last N days
     */
    getFocusPatterns: async (days = 14) => {
        try {
            const response = await api.get(`/analytics/focus-patterns?days=${days}`);
            return response;
        } catch (error) {
            throw error;
        }
    }
};

export default analyticsService;
