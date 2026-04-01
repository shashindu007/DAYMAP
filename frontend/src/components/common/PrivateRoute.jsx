import React from 'react';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './PrivateRoute.css';

const PrivateRoute = ({ children }) => {
    const { isAuthenticated, loading, logout, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

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
        { path: '/week', label: 'Week' },
        { path: '/tasks', label: 'Tasks' },
        { path: '/routines', label: 'Routines' },
        { path: '/analytics', label: 'Analytics' }
    ];

    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="header-brand">DayMap</div>
                
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
                    <span className="user-greeting">Hi, {user?.name || 'User'}</span>
                    <button onClick={() => navigate('/settings')} className="btn-icon" title="Settings">⚙️</button>
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
