import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
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
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL(outputType, quality);
};

const Settings = () => {
    const { user, logout, updateProfile, changePassword } = useAuth();
    const [profileForm, setProfileForm] = useState({
        name: user?.name || '',
        email: user?.email || '',
        timezone: user?.timezone || 'UTC',
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
    const [profileMessage, setProfileMessage] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);

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
        <div className="dashboard-container settings-page" style={{ maxWidth: '960px' }}>
            <h1>Settings</h1>

            <div className="card settings-card" style={{ marginTop: '1rem' }}>
                <h2>Profile Information</h2>
                <form className="calendar-task-form" style={{ gridTemplateColumns: '1fr 1fr' }} onSubmit={handleProfileSubmit}>
                    <div className="profile-header" style={{ gridColumn: '1 / -1' }}>
                        {profileForm.profile_image ? (
                            <img src={profileForm.profile_image} alt="Profile" className="profile-avatar" style={{ objectFit: 'cover' }} />
                        ) : (
                            <div className="profile-avatar">{initials}</div>
                        )}
                        <div>
                            <p className="profile-subtitle">Upload profile image, update details, and keep your account fresh.</p>
                            <input type="file" accept="image/*" onChange={handleProfileImageSelect} />
                        </div>
                    </div>

                    <input className="input" name="name" value={profileForm.name} onChange={handleProfileChange} placeholder="Name" required />
                    <input className="input" name="email" value={profileForm.email} onChange={handleProfileChange} placeholder="Email" required />
                    <input className="input" name="timezone" value={profileForm.timezone} onChange={handleProfileChange} placeholder="Timezone" />
                    <input className="input" name="phone" value={profileForm.phone} onChange={handleProfileChange} placeholder="Phone" />
                    <input className="input" name="location" value={profileForm.location} onChange={handleProfileChange} placeholder="Location" />
                    <input className="input" name="bio" value={profileForm.bio} onChange={handleProfileChange} placeholder="Short bio" />

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p className={profileMessage.toLowerCase().includes('fail') ? 'dashboard-error' : 'muted'}>{profileMessage}</p>
                        <Button type="submit" disabled={savingProfile}>{savingProfile ? 'Saving...' : 'Save Profile'}</Button>
                    </div>
                </form>
            </div>

            <div className="card settings-card" style={{ marginTop: '1rem' }}>
                <h2>Change Password</h2>
                <form className="calendar-task-form" style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }} onSubmit={handlePasswordSubmit}>
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
                    <Button type="submit" disabled={savingPassword}>{savingPassword ? 'Updating...' : 'Change Password'}</Button>
                    <p className={passwordMessage.toLowerCase().includes('fail') || passwordMessage.toLowerCase().includes('match') ? 'dashboard-error' : 'muted'} style={{ gridColumn: '1 / -1' }}>
                        {passwordMessage}
                    </p>
                </form>
            </div>

            <div className="card settings-card" style={{ marginTop: '1rem' }}>
                <h2>Session</h2>
                <p><strong>Logged in as:</strong> {user?.email}</p>
                <div style={{ marginTop: '1rem' }}>
                    <Button variant="danger" onClick={handleLogout}>
                        Logout
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
