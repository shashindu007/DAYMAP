import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TaskProvider } from './context/TaskContext';
import { ScheduleProvider } from './context/ScheduleContext';
import { ScheduleEditorProvider } from './context/ScheduleEditorContext';
import { ThemeProvider } from './context/ThemeContext';
import { RoutineProvider } from './context/RoutineContext';
import { WalletProvider } from './context/WalletContext';
import { FocusProvider } from './context/FocusContext';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import PrivateRoute from './components/common/PrivateRoute';
import usageService from './services/usageService';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import TodayView from './pages/TodayView';
import FocusDashboard from './pages/FocusDashboard';
import WeekView from './pages/WeekView';
import Tasks from './pages/Tasks';
import Routines from './pages/Routines';
import Analytics from './pages/Analytics';
import Wallet from './pages/Wallet';
import Settings from './pages/Settings';

// App.css (the design system) is imported in index.js so that it loads before
// every component/page stylesheet and can be overridden by them.

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
                    <RoutineProvider>
                        {/* A plain data provider, so it sits outside Router
                            with the others - that is what keeps today's spend
                            alive across navigation without refetching. */}
                        <WalletProvider>
                        <ScheduleProvider>
                            <Router>
                                {/* Inside Router but above Routes: a focus
                                    session must survive navigation between
                                    /today and /focus. */}
                                <FocusProvider>
                                {/* Above Routes so any page can open the task
                                    editor without navigating away. */}
                                <ScheduleEditorProvider>
                                {/* Toast wraps Notification: the reminder
                                    engine delivers through useToast(). Both sit
                                    inside Router because a clicked desktop
                                    notification navigates to /today. */}
                                <ToastProvider>
                                <NotificationProvider>
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
                                <Route path="/focus" element={
                                    <PrivateRoute>
                                        <FocusDashboard />
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
                                <Route path="/wallet" element={
                                    <PrivateRoute>
                                        <Wallet />
                                    </PrivateRoute>
                                } />
                                <Route path="/settings" element={
                                    <PrivateRoute>
                                        <Settings />
                                    </PrivateRoute>
                                } />
                                
                                {/* Default redirect */}
                                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                                    </Routes>
                                </div>
                                </NotificationProvider>
                                </ToastProvider>
                                </ScheduleEditorProvider>
                                </FocusProvider>
                            </Router>
                        </ScheduleProvider>
                        </WalletProvider>
                    </RoutineProvider>
                </TaskProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
