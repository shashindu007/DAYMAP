import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();

    return (
        <div className="dashboard-container">
            <h1>Dashboard</h1>
            <div className="dashboard-grid">
                <div className="dashboard-card" onClick={() => navigate('/today')}>
                    <h3>Today's Tasks</h3>
                    <p>View and manage your tasks for today</p>
                </div>
                <div className="dashboard-card" onClick={() => navigate('/week')}>
                    <h3>Week View</h3>
                    <p>See your tasks for the entire week</p>
                </div>
                <div className="dashboard-card" onClick={() => navigate('/routines')}>
                    <h3>Routines</h3>
                    <p>Manage your daily routines</p>
                </div>
                <div className="dashboard-card" onClick={() => navigate('/analytics')}>
                    <h3>Analytics</h3>
                    <p>View your productivity insights</p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
