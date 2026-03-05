import api from './api';

const authService = {
    /**
     * Register a new user
     */
    register: async (userData) => {
        try {
            const response = await api.post('/auth/register', userData);
            if (response.success && response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
            }
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Login user
     */
    login: async (credentials) => {
        try {
            const response = await api.post('/auth/login', credentials);
            if (response.success && response.data.token) {
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
            }
            return response;
        } catch (error) {
            throw error;
        }
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
        try {
            const response = await api.get('/auth/me');
            if (response.success) {
                localStorage.setItem('user', JSON.stringify(response.data));
            }
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Update user profile
     */
    updateProfile: async (userData) => {
        try {
            const response = await api.put('/auth/update-profile', userData);
            if (response.success) {
                localStorage.setItem('user', JSON.stringify(response.data));
            }
            return response;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Change password
     */
    changePassword: async (passwordData) => {
        try {
            const response = await api.put('/auth/change-password', passwordData);
            return response;
        } catch (error) {
            throw error;
        }
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
        return user ? JSON.parse(user) : null;
    }
};

export default authService;
