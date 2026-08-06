import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './UserMenu.css';

/** Two initials, falling back to 'U' for a nameless account. */
export const initialsFor = (name) => {
    const normalized = (name || '').trim();
    if (!normalized) return 'U';
    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

/**
 * Account menu in the top-right corner.
 *
 * Settings, dark mode and log out used to sit in the header as three separate
 * controls, which made log out - the rarest action - the loudest thing in the
 * bar. Collapsing them behind the avatar follows the convention every other
 * web app uses, so the destructive action is one deliberate step away instead
 * of one stray click.
 */
const UserMenu = () => {
    const { user, logout } = useAuth();
    const { darkMode, toggleDarkMode } = useTheme();
    const navigate = useNavigate();

    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    const close = () => setOpen(false);

    // Escape and click-outside, matching NotificationBell so the two dropdowns
    // in this header behave identically.
    useEffect(() => {
        if (!open) return undefined;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                close();
                triggerRef.current?.focus();
            }
        };
        const onPointerDown = (event) => {
            if (menuRef.current?.contains(event.target)) return;
            if (triggerRef.current?.contains(event.target)) return;
            close();
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('mousedown', onPointerDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('mousedown', onPointerDown);
        };
    }, [open]);

    const handleLogout = async () => {
        close();
        await logout();
        navigate('/login');
    };

    const goToSettings = () => {
        close();
        navigate('/settings');
    };

    return (
        <div className="user-menu-wrap">
            <button
                ref={triggerRef}
                type="button"
                className="user-menu-trigger"
                aria-label={`Account menu for ${user?.name || 'your account'}`}
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={() => setOpen((value) => !value)}
            >
                <span className="user-menu-avatar">
                    {user?.profile_image
                        ? <img src={user.profile_image} alt="" />
                        : <span aria-hidden>{initialsFor(user?.name)}</span>}
                </span>
                <span className="user-menu-caret" aria-hidden>▾</span>
            </button>

            {open && (
                <div className="user-menu" role="menu" aria-label="Account" ref={menuRef}>
                    <div className="user-menu-identity">
                        <p className="user-menu-name">{user?.name || 'Your account'}</p>
                        {user?.email && <p className="user-menu-email">{user.email}</p>}
                    </div>

                    <div className="user-menu-group">
                        <button
                            type="button"
                            role="menuitem"
                            className="user-menu-item"
                            onClick={goToSettings}
                        >
                            <span className="user-menu-icon" aria-hidden>⚙️</span>
                            <span>Settings</span>
                        </button>

                        {/* A switch, not a link: it toggles in place and the
                            menu stays open so the change is visible. */}
                        <button
                            type="button"
                            role="menuitemcheckbox"
                            aria-checked={darkMode}
                            className="user-menu-item"
                            onClick={toggleDarkMode}
                        >
                            <span className="user-menu-icon" aria-hidden>{darkMode ? '☀️' : '🌙'}</span>
                            <span>Dark mode</span>
                            <span className={`user-menu-switch ${darkMode ? 'is-on' : ''}`} aria-hidden />
                        </button>
                    </div>

                    <div className="user-menu-group">
                        <button
                            type="button"
                            role="menuitem"
                            className="user-menu-item user-menu-item--danger"
                            onClick={handleLogout}
                        >
                            <span className="user-menu-icon" aria-hidden>↪</span>
                            <span>Log out</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserMenu;
