import React from 'react';

/**
 * The repeated header / count / empty-state shell around each of Today's
 * task lists. Renders nothing at all when empty unless `alwaysShow` is set,
 * so the page does not fill up with empty placeholders.
 */
const TaskSection = ({
    title,
    subtitle,
    count,
    emptyText,
    alwaysShow = false,
    children,
    modifier = ''
}) => {
    const isEmpty = !count;

    if (isEmpty && !alwaysShow) return null;

    return (
        <div className={`task-section ${modifier}`}>
            <div className="task-section-header">
                <div>
                    <h2>{title}</h2>
                    {subtitle && <span>{subtitle}</span>}
                </div>
                <span className="task-section-count">{count}</span>
            </div>
            <div className="task-section-body">
                {isEmpty ? (
                    <div className="task-section-empty">{emptyText}</div>
                ) : children}
            </div>
        </div>
    );
};

export default TaskSection;
