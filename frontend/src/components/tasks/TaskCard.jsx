import React from 'react';
import Button from '../common/Button';

/**
 * One task row. Emits the existing .task-item class contract from
 * styles/task-card.css, so it drops into any of Today's sections.
 *
 * @param {Object}  item            normalized day item (see utils/dayItems)
 * @param {String}  variant         current | upcoming | past | completed | missed | review | anytime
 * @param {Object}  badge           { label, className }
 * @param {Number}  progressPercent 0-100, omit to hide the bar
 * @param {Array}   actions         [{ key, label, variant, onClick, disabled }]
 * @param {String}  routineName     shows a routine pill when present
 */
const TaskCard = ({
    item,
    variant = 'upcoming',
    badge,
    progressPercent = null,
    actions = [],
    routineName = null,
    hint = null
}) => {
    if (!item) return null;

    const isDone = item.status === 'completed';

    return (
        <div className={`task-item task-item--${variant} ${isDone ? 'completed' : ''}`}>
            <div className="task-content">
                <div className="task-title-row">
                    <h3 className="task-title">{item.title}</h3>
                    {badge && (
                        <span className={`task-status-badge ${badge.className || ''}`}>
                            {badge.label}
                        </span>
                    )}
                </div>

                {item.description && (
                    <p className="task-description">{item.description}</p>
                )}

                <div className="task-meta">
                    {item.startLabel && (
                        <span className="task-time">
                            ⏰ {item.startLabel}{item.endLabel ? ` - ${item.endLabel}` : ''}
                        </span>
                    )}
                    {item.actualMinutes ? (
                        <span className="task-duration">⏱ {item.actualMinutes} min</span>
                    ) : item.durationMinutes ? (
                        <span className="task-duration">⏱ {item.durationMinutes} min</span>
                    ) : null}
                    {item.priority && (
                        <span className={`task-priority priority-${item.priority}`}>
                            {item.priority}
                        </span>
                    )}
                    {routineName && (
                        <span className="task-badge-routine">🔁 {routineName}</span>
                    )}
                </div>

                {progressPercent !== null && (
                    <div className="task-progress">
                        <div
                            className="task-progress-fill"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                )}

                {hint && <div className="task-hint">{hint}</div>}

                {actions.length > 0 && (
                    <div className="task-actions">
                        {actions.map((action) => (
                            <Button
                                key={action.key || action.label}
                                variant={action.variant || 'secondary'}
                                className="task-action-btn"
                                onClick={action.onClick}
                                disabled={action.disabled}
                            >
                                {action.label}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskCard;
