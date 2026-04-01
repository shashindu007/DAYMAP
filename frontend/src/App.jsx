import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { ThemeProvider } from './context/ThemeContext';
import PrivateRoute from './components/common/PrivateRoute';
import usageService from './services/usageService';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import TodayView from './pages/TodayView';
import WeekView from './pages/WeekView';
import Tasks from './pages/Tasks';
import Routines from './pages/Routines';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

import './App.css';

const RouteUsageTracker = () => {
    const location = useLocation();

    useEffect(() => {
        usageService.recordRouteVisit(location.pathname);
    }, [location.pathname]);

    return null;
};

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <TaskProvider>
                    <Router>
                        <div className="App">
                            <RouteUsageTracker />
                            <Routes>
                                {/* Public routes */}
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                
                                {/* Protected routes */}
                                <Route path="/dashboard" element={
                                    <PrivateRoute>
                                        <Dashboard />
                                    </PrivateRoute>
                                } />
                                <Route path="/today" element={
                                    <PrivateRoute>
                                        <TodayView />
                                    </PrivateRoute>
                                } />
                                <Route path="/week" element={
                                    <PrivateRoute>
                                        <WeekView />
                                    </PrivateRoute>
                                } />
                                <Route path="/tasks" element={
                                    <PrivateRoute>
                                        <Tasks />
                                    </PrivateRoute>
                                } />
                                <Route path="/routines" element={
                                    <PrivateRoute>
                                        <Routines />
                                    </PrivateRoute>
                                } />
                                <Route path="/analytics" element={
                                    <PrivateRoute>
                                        <Analytics />
                                    </PrivateRoute>
                                } />
                                <Route path="/settings" element={
                                    <PrivateRoute>
                                        <Settings />
                                    </PrivateRoute>
                                } />
                                
                                {/* Default redirect */}
                                <Route path="/" element={<Navigate to="/today" replace />} />
                                <Route path="*" element={<Navigate to="/today" replace />} />
                            </Routes>
                        </div>
                    </Router>
                </TaskProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
