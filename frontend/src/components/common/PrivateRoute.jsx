import React, { useEffect, useState } from 'react';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './PrivateRoute.css';

const NAV_LINKS = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠', tone: 'violet' },
    { path: '/today', label: 'Today', icon: '☀️', tone: 'amber' },
    { path: '/focus', label: 'Focus', icon: '🎯', tone: 'rose' },
    { path: '/week', label: 'Week', icon: '🗓️', tone: 'cyan' },
    { path: '/tasks', label: 'Tasks', icon: '✅', tone: 'green' },
    { path: '/routines', label: 'Routines', icon: '🔁', tone: 'indigo' },
    { path: '/analytics', label: 'Analytics', icon: '📊', tone: 'pink' }
];

const PrivateRoute = ({ children }) => {
    const { isAuthenticated, loading, logout, user } = useAuth();
    const { darkMode, toggleDarkMode } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [now, setNow] = useState(new Date());
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Close the mobile drawer whenever the route changes
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="loader-container">
                <div className="loader-stack">
                    <div className="spinner"></div>
                    <p className="loader-text">Getting your day ready…</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const headerInitials = (() => {
        const normalized = (user?.name || '').trim();
        if (!normalized) return 'U';
        const parts = normalized.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    })();

    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="header-brand">
                    <div className="brand-avatar">
                        {user?.profile_image ? (
                            <img src={user.profile_image} alt="Profile" />
                        ) : (
                            <span>{headerInitials}</span>
                        )}
                    </div>
                    <div className="brand-text">
                        <span className="brand-title">DayMap</span>
                        <span className="brand-greeting">{greeting}, {user?.name?.split(' ')[0] || 'there'} 👋</span>
                    </div>
                </div>

                <nav className={`header-nav ${menuOpen ? 'is-open' : ''}`}>
                    {NAV_LINKS.map((link) => (
                        <Link
                            key={link.path}
                            to={link.path}
                            data-tone={link.tone}
                            className={`nav-item ${location.pathname.startsWith(link.path) ? 'active' : ''}`}
                        >
                            <span className="nav-icon" aria-hidden>{link.icon}</span>
                            <span className="nav-label">{link.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="header-actions">
                    <div className="header-time-badge">
                        <span className="header-time-dot" aria-hidden />
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

                    <button
                        onClick={toggleDarkMode}
                        className="icon-btn theme-toggle"
                        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        <span aria-hidden>{darkMode ? '☀️' : '🌙'}</span>
                    </button>

                    <button
                        onClick={() => navigate('/settings')}
                        className="icon-btn settings-btn"
                        title="Settings"
                        aria-label="Settings"
                    >
                        <span aria-hidden>⚙️</span>
                    </button>

                    <button onClick={handleLogout} className="nav-logout-btn" title="Log out">
                        <span aria-hidden>↪</span>
                        <span className="logout-label">Log Out</span>
                    </button>

                    <button
                        className="icon-btn menu-toggle"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={menuOpen}
                    >
                        <span aria-hidden>{menuOpen ? '✕' : '☰'}</span>
                    </button>
                </div>
            </header>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

export default PrivateRoute;
