import React, { useEffect, useState } from 'react';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useScheduleEditor } from '../../context/ScheduleEditorContext';
import NotificationBell from './NotificationBell';
import UserMenu from './UserMenu';
import './PrivateRoute.css';

const NAV_LINKS = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/today', label: 'Today', icon: '☀️' },
    { path: '/week', label: 'Week', icon: '🗓️' },
    { path: '/tasks', label: 'Tasks', icon: '✅' },
    { path: '/routines', label: 'Routines', icon: '🔁' },
    { path: '/wallet', label: 'Wallet', icon: '👛' },
    { path: '/analytics', label: 'Analytics', icon: '📊' }
];

const PrivateRoute = ({ children }) => {
    const { isAuthenticated, loading, user } = useAuth();
    const { openEditor } = useScheduleEditor();
    const location = useLocation();
    const [now, setNow] = useState(new Date());
    const [menuOpen, setMenuOpen] = useState(false);

    // 30s, not 1s: the badge shows minutes now, so a per-second re-render of
    // the whole shell bought nothing but a clock that twitched in the corner.
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(interval);
    }, []);

    // Close the mobile drawer whenever the route changes
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

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

    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    return (
        <div className="app-shell">
            <header className="app-header">
                {/* The avatar lives in the account menu on the right now, where
                    people go looking for it - so the brand is just the brand. */}
                <div className="header-brand">
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
                            className={`nav-item ${location.pathname.startsWith(link.path) ? 'active' : ''}`}
                        >
                            <span className="nav-icon" aria-hidden>{link.icon}</span>
                            <span className="nav-label">{link.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="header-actions">
                    <button
                        className="btn btn-sm btn-primary header-new-task"
                        type="button"
                        onClick={() => openEditor()}
                    >
                        New task
                    </button>

                    {/* Date only. The running clock redrew the header every
                        second to duplicate what the OS taskbar already shows;
                        which day you are looking at is the part that matters
                        in a day planner. */}
                    <div className="header-time-badge">
                        <span className="header-time-dot" aria-hidden />
                        <span className="header-time-text">
                            {now.toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                            })}
                        </span>
                    </div>

                    <NotificationBell />

                    <UserMenu />

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
