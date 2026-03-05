import React from 'react';
import './Input.css';

const Input = ({ 
    label, 
    type = 'text', 
    name, 
    value, 
    onChange, 
    placeholder,
    required = false,
    error,
    className = ''
}) => {
    return (
        <div className={`input-group ${className}`}>
            {label && (
                <label htmlFor={name} className="input-label">
                    {label} {required && <span className="required">*</span>}
                </label>
            )}
            <input
                type={type}
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                className={`input ${error ? 'input-error' : ''}`}
            />
            {error && <span className="error-message">{error}</span>}
        </div>
    );
};

export default Input;
