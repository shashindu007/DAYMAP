import React from 'react';
import ReactDOM from 'react-dom/client';
// Load order matters: reset/base -> design system -> component & page styles.
import './index.css';
import './App.css';
import './styles/task-card.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
