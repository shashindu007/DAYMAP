import React, { useEffect, useState } from 'react';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './PrivateRoute.css';

const PrivateRoute = ({ children }) => {
    const { isAuthenticated, loading, logout, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="loader-container">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const navLinks = [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/today', label: 'Today' },
        { path: '/focus', label: 'Focus' },
        { path: '/week', label: 'Week' },
        { path: '/tasks', label: 'Tasks' },
        { path: '/routines', label: 'Routines' },
        { path: '/analytics', label: 'Analytics' }
    ];

    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="header-brand">
                    <span className="brand-title">DayMap</span>
                    <span className="brand-greeting">Hi, {user?.name || 'User'}</span>
                </div>
                
                <nav className="header-nav">
                    {navLinks.map((link) => (
                        <Link 
                            key={link.path} 
                            to={link.path} 
                            className={`nav-item ${location.pathname.startsWith(link.path) ? 'active' : ''}`}
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <div className="header-actions">
                    <div className="header-time-badge">
                        <span className="header-time-text">
                            {now.toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                            })}
                            {', '}
                            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    </div>
                    <button onClick={() => navigate('/settings')} className="settings-btn" title="Settings">
                        <span aria-hidden>⚙️</span>
                        Settings
                    </button>
                    <button onClick={handleLogout} className="btn btn-outline nav-logout-btn">Log Out</button>
                </div>
            </header>
            
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default PrivateRoute;
