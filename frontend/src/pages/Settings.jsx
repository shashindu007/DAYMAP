import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import Button from '../components/common/Button';
import { LEAD_MINUTE_OPTIONS, mergeNotificationPrefs } from '../utils/notificationPrefs';
import { CURRENCY_OPTIONS, DEFAULT_CURRENCY } from '../utils/money';
import './Dashboard.css';
import './Settings.css';

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.readAsDataURL(file);
});

const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to process selected image.'));
    image.src = src;
});

const compressImageDataUrl = async (dataUrl, options = {}) => {
    const {
        maxWidth = 640,
        maxHeight = 640,
        quality = 0.72,
        outputType = 'image/jpeg'
    } = options;

    const image = await loadImage(dataUrl);
    const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const targetWidth = Math.max(1, Math.round(image.width * ratio));
    const targetHeight = Math.max(1, Math.round(image.height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Unable to initialize image canvas.');
    }
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL(outputType, quality);
};

const Settings = () => {
    const { user, logout, updateProfile, changePassword } = useAuth();
    const [profileForm, setProfileForm] = useState({
        name: user?.name || '',
        email: user?.email || '',
        timezone: user?.timezone || 'UTC',
        // Lives in profileForm, not its own form: the notifications save at
        // line ~96 spreads profileForm, so a separately-held currency would be
        // clobbered back to its old value every time preferences were saved.
        currency: user?.currency || DEFAULT_CURRENCY,
        bio: user?.bio || '',
        phone: user?.phone || '',
        location: user?.location || '',
        profile_image: user?.profile_image || ''
    });
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [notifPrefs, setNotifPrefs] = useState(
        () => mergeNotificationPrefs(user?.notification_preferences)
    );
    const [profileMessage, setProfileMessage] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [notifMessage, setNotifMessage] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [savingNotifs, setSavingNotifs] = useState(false);

    const { permission, canUseBrowserNotifications, requestBrowserPermission } = useNotifications();

    // The engine reads preferences off the user record, so re-sync whenever it
    // changes underneath us (login, /auth/me revalidation, another tab).
    useEffect(() => {
        setNotifPrefs(mergeNotificationPrefs(user?.notification_preferences));
    }, [user?.notification_preferences]);

    // Narrow on purpose: keyed to the server value alone, so it only fires when
    // that actually changes (login, /auth/me revalidation, another tab). An
    // unsaved selection here is never overwritten, and no other profile field
    // is touched.
    useEffect(() => {
        if (!user?.currency) return;
        setProfileForm((prev) => (
            prev.currency === user.currency ? prev : { ...prev, currency: user.currency }
        ));
    }, [user?.currency]);

    const setNotifField = (field, value) => setNotifPrefs((prev) => ({ ...prev, [field]: value }));
    const setQuietField = (field, value) => setNotifPrefs((prev) => ({
        ...prev,
        quiet_hours: { ...prev.quiet_hours, [field]: value }
    }));

    const handleNotifSubmit = async (event) => {
        event.preventDefault();
        setSavingNotifs(true);
        setNotifMessage('');
        try {
            // Send the profile alongside: User.update $sets the preference
            // subdocument wholesale, so a partial payload would drop fields.
            await updateProfile({ ...profileForm, notification_preferences: notifPrefs });
            setNotifMessage('Notification settings saved.');
        } catch (error) {
            setNotifMessage(error?.response?.data?.message || 'Failed to save notification settings.');
        } finally {
            setSavingNotifs(false);
        }
    };

    /** Turning the toggle on is the user gesture that lets us prompt. */
    const handleBrowserPushToggle = async (checked) => {
        setNotifField('browser_push', checked);
        if (checked && permission === 'default') await requestBrowserPermission();
    };

    const initials = useMemo(() => {
        const normalized = (profileForm.name || '').trim();
        if (!normalized) return 'U';
        const parts = normalized.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }, [profileForm.name]);

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
    };

    const handleProfileChange = (event) => {
        const { name, value } = event.target;
        setProfileForm((prev) => ({ ...prev, [name]: value }));
    };

    const handlePasswordChange = (event) => {
        const { name, value } = event.target;
        setPasswordForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleProfileImageSelect = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setProfileMessage('Please select an image file (png/jpg/webp/etc).');
            return;
        }

        try {
            const originalDataUrl = await fileToDataUrl(file);
            const compressedDataUrl = await compressImageDataUrl(originalDataUrl);

            if (compressedDataUrl.length > 2_800_000) {
                setProfileMessage('Image is still too large after compression. Please choose a smaller photo.');
                return;
            }

            setProfileForm((prev) => ({ ...prev, profile_image: compressedDataUrl }));
            setProfileMessage('Image optimized and selected. Click “Save Profile” to upload.');
        } catch (error) {
            setProfileMessage(error.message || 'Could not process image.');
        }
    };

    const handleProfileSubmit = async (event) => {
        event.preventDefault();
        setProfileMessage('');

        try {
            setSavingProfile(true);
            await updateProfile(profileForm);
            setProfileMessage('Profile updated successfully.');
        } catch (error) {
            setProfileMessage(error?.message || 'Failed to update profile.');
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();
        setPasswordMessage('');

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordMessage('New password and confirmation do not match.');
            return;
        }

        try {
            setSavingPassword(true);
            await changePassword({
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            });
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordMessage('Password changed successfully.');
        } catch (error) {
            setPasswordMessage(error?.message || 'Failed to change password.');
        } finally {
            setSavingPassword(false);
        }
    };

    return (
        <div className="dashboard-container settings-page">
            <div className="settings-header">
                <div>
                    <h1>Settings</h1>
                    <p className="muted">Keep your profile up to date and manage security preferences.</p>
                </div>
            </div>

            <div className="card settings-card">
                <div className="settings-card-header">
                    <div>
                        <h2>Profile Information</h2>
                        <p className="settings-card-subtitle">Upload a profile image, update details, and keep your account fresh.</p>
                    </div>
                    <div className="settings-avatar-wrap">
                        {profileForm.profile_image ? (
                            <img src={profileForm.profile_image} alt="Profile" className="settings-avatar" />
                        ) : (
                            <div className="settings-avatar settings-avatar-fallback">{initials}</div>
                        )}
                    </div>
                </div>

                <form className="settings-form" onSubmit={handleProfileSubmit} aria-busy={savingProfile}>
                    <div className="settings-upload">
                        <label className="settings-upload-btn">
                            <input type="file" accept="image/*" onChange={handleProfileImageSelect} disabled={savingProfile} />
                            Upload Photo
                        </label>
                        <span className="muted">PNG/JPG/WebP up to ~2.8MB</span>
                    </div>

                    <div className="settings-grid">
                        <input className="input" name="name" value={profileForm.name} onChange={handleProfileChange} placeholder="Name" required />
                        <input className="input" name="email" value={profileForm.email} onChange={handleProfileChange} placeholder="Email" required />
                        <input className="input" name="timezone" value={profileForm.timezone} onChange={handleProfileChange} placeholder="Timezone" />
                        <select
                            className="input"
                            name="currency"
                            value={profileForm.currency}
                            onChange={handleProfileChange}
                            aria-label="Currency"
                        >
                            {CURRENCY_OPTIONS.map((option) => (
                                <option key={option.code} value={option.code}>
                                    {option.code} — {option.label}
                                </option>
                            ))}
                        </select>
                        <input className="input" name="phone" value={profileForm.phone} onChange={handleProfileChange} placeholder="Phone" />
                        <input className="input" name="location" value={profileForm.location} onChange={handleProfileChange} placeholder="Location" />
                        <input className="input" name="bio" value={profileForm.bio} onChange={handleProfileChange} placeholder="Short bio" />
                    </div>

                    <div className="settings-actions">
                        <p
                            className={profileMessage.toLowerCase().includes('fail') ? 'alert alert-error' : 'muted'}
                            role="status"
                            aria-live="polite"
                        >
                            {profileMessage}
                        </p>
                        <Button type="submit" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Profile'}</Button>
                    </div>
                </form>
            </div>

            <div className="card settings-card">
                <div className="settings-card-header">
                    <div>
                        <h2>Change Password</h2>
                        <p className="settings-card-subtitle">Strengthen account security with a fresh password.</p>
                    </div>
                </div>
                <form className="settings-form" onSubmit={handlePasswordSubmit} aria-busy={savingPassword}>
                    <div className="settings-grid settings-grid-3">
                        <input
                            className="input"
                            type="password"
                            name="currentPassword"
                            value={passwordForm.currentPassword}
                            onChange={handlePasswordChange}
                            placeholder="Current password"
                            required
                        />
                        <input
                            className="input"
                            type="password"
                            name="newPassword"
                            value={passwordForm.newPassword}
                            onChange={handlePasswordChange}
                            placeholder="New password"
                            required
                        />
                        <input
                            className="input"
                            type="password"
                            name="confirmPassword"
                            value={passwordForm.confirmPassword}
                            onChange={handlePasswordChange}
                            placeholder="Confirm new password"
                            required
                        />
                    </div>
                    <div className="settings-actions">
                        <p
                            className={passwordMessage.toLowerCase().includes('fail') || passwordMessage.toLowerCase().includes('match') ? 'alert alert-error' : 'muted'}
                            role="status"
                            aria-live="polite"
                        >
                            {passwordMessage}
                        </p>
                        <Button type="submit" disabled={savingPassword}>{savingPassword ? 'Updating...' : 'Change Password'}</Button>
                    </div>
                </form>
            </div>

            <div className="card settings-card">
                <div className="settings-card-header">
                    <div>
                        <h2>Notifications</h2>
                        <p className="settings-card-subtitle">
                            Reminders fire while DayMap is open in a tab, including in the background.
                        </p>
                    </div>
                </div>
                <form className="settings-form" onSubmit={handleNotifSubmit} aria-busy={savingNotifs}>
                    <label className="notif-toggle">
                        <input
                            type="checkbox"
                            checked={notifPrefs.enabled}
                            onChange={(event) => setNotifField('enabled', event.target.checked)}
                        />
                        <span>
                            <strong>Enable reminders</strong>
                            <em>Turn everything below on or off in one place.</em>
                        </span>
                    </label>

                    <fieldset className="notif-fieldset" disabled={!notifPrefs.enabled}>
                        <div className="notif-field">
                            <label htmlFor="lead-minutes">Remind me before a task starts</label>
                            <select
                                id="lead-minutes"
                                className="input"
                                value={notifPrefs.lead_minutes}
                                onChange={(event) => setNotifField('lead_minutes', Number(event.target.value))}
                            >
                                <option value={0}>Don&apos;t remind me early</option>
                                {LEAD_MINUTE_OPTIONS.map((minutes) => (
                                    <option key={minutes} value={minutes}>{minutes} minutes before</option>
                                ))}
                            </select>
                        </div>

                        <label className="notif-toggle">
                            <input
                                type="checkbox"
                                checked={notifPrefs.notify_on_start}
                                onChange={(event) => setNotifField('notify_on_start', event.target.checked)}
                            />
                            <span>
                                <strong>Ping me when a task starts</strong>
                                <em>A second nudge at the exact start time.</em>
                            </span>
                        </label>

                        <label className="notif-toggle">
                            <input
                                type="checkbox"
                                checked={notifPrefs.notify_on_end}
                                onChange={(event) => setNotifField('notify_on_end', event.target.checked)}
                            />
                            <span>
                                <strong>Ask me when a task ends</strong>
                                <em>&ldquo;Did you finish?&rdquo; with mark-done buttons, so nothing piles up in Needs Review.</em>
                            </span>
                        </label>

                        <label className="notif-toggle">
                            <input
                                type="checkbox"
                                checked={notifPrefs.daily_digest}
                                onChange={(event) => setNotifField('daily_digest', event.target.checked)}
                            />
                            <span>
                                <strong>Morning summary of the day</strong>
                                <em>Delivered the first time you open DayMap at or after this time.</em>
                            </span>
                        </label>

                        <div className="notif-field">
                            <label htmlFor="digest-time">Summary time</label>
                            <input
                                id="digest-time"
                                className="input"
                                type="time"
                                value={notifPrefs.digest_time}
                                onChange={(event) => setNotifField('digest_time', event.target.value)}
                                disabled={!notifPrefs.daily_digest}
                            />
                        </div>

                        <label className="notif-toggle">
                            <input
                                type="checkbox"
                                checked={notifPrefs.quiet_hours.enabled}
                                onChange={(event) => setQuietField('enabled', event.target.checked)}
                            />
                            <span>
                                <strong>Quiet hours</strong>
                                <em>Nothing interrupts during this window. Reminders still appear in the bell.</em>
                            </span>
                        </label>

                        <div className="notif-field notif-field--pair">
                            <div>
                                <label htmlFor="quiet-start">Quiet from</label>
                                <input
                                    id="quiet-start"
                                    className="input"
                                    type="time"
                                    value={notifPrefs.quiet_hours.start}
                                    onChange={(event) => setQuietField('start', event.target.value)}
                                    disabled={!notifPrefs.quiet_hours.enabled}
                                />
                            </div>
                            <div>
                                <label htmlFor="quiet-end">until</label>
                                <input
                                    id="quiet-end"
                                    className="input"
                                    type="time"
                                    value={notifPrefs.quiet_hours.end}
                                    onChange={(event) => setQuietField('end', event.target.value)}
                                    disabled={!notifPrefs.quiet_hours.enabled}
                                />
                            </div>
                        </div>

                        {canUseBrowserNotifications ? (
                            <>
                                <label className="notif-toggle">
                                    <input
                                        type="checkbox"
                                        checked={notifPrefs.browser_push}
                                        disabled={permission === 'denied'}
                                        onChange={(event) => handleBrowserPushToggle(event.target.checked)}
                                    />
                                    <span>
                                        <strong>Desktop notifications</strong>
                                        <em>
                                            {permission === 'granted'
                                                ? 'Allowed by your browser.'
                                                : permission === 'denied'
                                                    ? 'Blocked in your browser settings — re-enable it from the padlock icon in the address bar.'
                                                    : 'Your browser will ask for permission when you turn this on.'}
                                        </em>
                                    </span>
                                </label>

                                {notifPrefs.browser_push && permission === 'default' && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-secondary notif-permission-btn"
                                        onClick={requestBrowserPermission}
                                    >
                                        Ask for permission again
                                    </button>
                                )}
                            </>
                        ) : (
                            <p className="muted">
                                Your browser doesn&apos;t support desktop notifications. In-app reminders still work.
                            </p>
                        )}
                    </fieldset>

                    <div className="settings-actions">
                        <p
                            className={notifMessage.toLowerCase().includes('fail') ? 'alert alert-error' : 'muted'}
                            role="status"
                            aria-live="polite"
                        >
                            {notifMessage}
                        </p>
                        <Button type="submit" disabled={savingNotifs}>
                            {savingNotifs ? 'Saving...' : 'Save Notifications'}
                        </Button>
                    </div>
                </form>
            </div>

            <div className="card settings-card settings-session">
                <div>
                    <h2>Session</h2>
                    <p className="muted">Logged in as <strong>{user?.email}</strong></p>
                </div>
                <Button variant="danger" onClick={handleLogout}>
                    Log out
                </Button>
            </div>
        </div>
    );
};

export default Settings;
