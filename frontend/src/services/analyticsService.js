import api from './api';

const analyticsService = {
    /**
     * Get daily analytics
     */
    getDailyAnalytics: async (date) => {
        return api.get(`/analytics/daily/${date}`);
    },

    /**
     * Get weekly analytics
     */
    getWeeklyAnalytics: async (startDate, endDate) => {
        const params = startDate && endDate
            ? `?start_date=${startDate}&end_date=${endDate}`
            : '';
        return api.get(`/analytics/weekly${params}`);
    },

    /**
     * Get monthly analytics
     */
    getMonthlyAnalytics: async (year, month) => {
        const params = year && month ? `?year=${year}&month=${month}` : '';
        return api.get(`/analytics/monthly${params}`);
    },

    /**
     * Get analytics summary
     */
    getSummary: async () => {
        return api.get('/analytics/summary');
    },

    /**
     * Get productivity trends
     */
    getTrends: async (days = 30) => {
        return api.get(`/analytics/trends?days=${days}`);
    },

    /**
     * Record completed focus session
     */
    logFocusSession: async (sessionData) => {
        return api.post('/analytics/focus-session', sessionData);
    },

    /**
     * Get focus patterns for last N days
     */
    getFocusPatterns: async (days = 14) => {
        return api.get(`/analytics/focus-patterns?days=${days}`);
    }
};

export default analyticsService;
