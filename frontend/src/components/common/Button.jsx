import React from 'react';
import './Button.css';

const Button = ({ 
    children, 
    onClick, 
    type = 'button', 
    variant = 'primary', 
    disabled = false,
    fullWidth = false,
    loading = false,
    className = ''
}) => {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            className={`btn btn-${variant} ${fullWidth ? 'btn-full' : ''} ${className}`}
        >
            {loading ? (
                <>
                    <div className="spinner-small"></div>
                    Loading...
                </>
            ) : children}
        </button>
    );
};

export default Button;
