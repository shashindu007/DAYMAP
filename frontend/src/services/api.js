import axios from 'axios';
import authService from './authService';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3010/api';
const API_TIMEOUT = Number.parseInt(process.env.REACT_APP_API_TIMEOUT, 10) || 10000;

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    timeout: API_TIMEOUT,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle errors
api.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        if (error.response) {
            // Handle 401 Unauthorized
            if (error.response.status === 401) {
                authService.clearSession();
                const path = window.location.pathname;
                if (path !== '/login' && path !== '/register') {
                    window.location.href = '/login';
                }
            }
            
            // Return error message from server
            return Promise.reject(error.response.data);
        } else if (error.request) {
            return Promise.reject({
                success: false,
                message: 'No response from server. Please check your connection.'
            });
        } else {
            return Promise.reject({
                success: false,
                message: error.message || 'An error occurred'
            });
        }
    }
);

export default api;
