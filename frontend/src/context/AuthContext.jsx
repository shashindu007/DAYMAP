import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Validate existing session on mount
        const initializeAuth = async () => {
            const storedUser = authService.getStoredUser();
            const hasToken = authService.isAuthenticated();

            if (!hasToken) {
                setUser(null);
                setLoading(false);
                return;
            }

            if (storedUser) {
                setUser(storedUser);
            }

            try {
                const response = await authService.getCurrentUser();
                setUser(response?.data || null);
            } catch {
                authService.clearSession();
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, []);

    const register = async (userData) => {
        try {
            setError(null);
            const response = await authService.register(userData);
            setUser(response.data.user);
            return response;
        } catch (error) {
            setError(error.message || 'Registration failed');
            throw error;
        }
    };

    const login = async (credentials) => {
        try {
            setError(null);
            const response = await authService.login(credentials);
            setUser(response.data.user);
            return response;
        } catch (error) {
            setError(error.message || 'Login failed');
            throw error;
        }
    };

    const logout = async () => {
        try {
            await authService.logout();
            setUser(null);
            setError(null);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const updateProfile = async (userData) => {
        try {
            setError(null);
            const response = await authService.updateProfile(userData);
            setUser(response.data);
            return response;
        } catch (error) {
            setError(error.message || 'Profile update failed');
            throw error;
        }
    };

    const value = {
        user,
        loading,
        error,
        register,
        login,
        logout,
        updateProfile,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
