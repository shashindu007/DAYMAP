import api from './api';

const authService = {
    /**
     * Register a new user
     */
    register: async (userData) => {
        const response = await api.post('/auth/register', userData);
        if (response.success && response.data.token) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response;
    },

    /**
     * Login user 
     */
    login: async (credentials) => {
        const response = await api.post('/auth/login', credentials);
        if (response.success && response.data.token) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response;
    },

    /**
     * Logout user
     */
    logout: async () => {
        try {
            await api.post('/auth/logout');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        } catch (error) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    },

    /**
     * Get current user
     */
    getCurrentUser: async () => {
        const response = await api.get('/auth/me');
        if (response.success) {
            localStorage.setItem('user', JSON.stringify(response.data));
        }
        return response;
    },

    /**
     * Update user profile
     */
    updateProfile: async (userData) => {
        const response = await api.put('/auth/update-profile', userData);
        if (response.success) {
            localStorage.setItem('user', JSON.stringify(response.data));
        }
        return response;
    },

    /**
     * Change password
     */
    changePassword: async (passwordData) => {
        return api.put('/auth/change-password', passwordData);
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated: () => {
        return !!localStorage.getItem('token');
    },

    /**
     * Get stored user data
     */
    getStoredUser: () => {
        const user = localStorage.getItem('user');
        if (!user) return null;

        try {
            return JSON.parse(user);
        } catch {
            localStorage.removeItem('user');
            return null;
        }
    },

    clearSession: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};

export default authService;
