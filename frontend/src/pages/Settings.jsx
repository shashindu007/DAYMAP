import React from 'react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';

const Settings = () => {
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        window.location.href = '/login';
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1>Settings</h1>
            <div className="card" style={{ marginTop: '2rem' }}>
                <h2>Profile Information</h2>
                <p><strong>Name:</strong> {user?.name}</p>
                <p><strong>Email:</strong> {user?.email}</p>
                <p><strong>Timezone:</strong> {user?.timezone}</p>
                <div style={{ marginTop: '2rem' }}>
                    <Button variant="danger" onClick={handleLogout}>
                        Logout
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
