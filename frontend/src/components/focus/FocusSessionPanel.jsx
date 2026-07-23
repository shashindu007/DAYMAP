import React, { useEffect, useState } from 'react';
import { useFocus } from '../../context/FocusContext';
import {
    FOCUS_CATEGORY_OPTIONS,
    FOCUS_GOAL_PRESETS,
    formatElapsed
} from '../../utils/focusTime';
import './FocusSessionPanel.css';

/**
 * The focus session UI, shared by /focus (variant="full") and the Today
 * Dashboard (variant="compact"). All state comes from FocusContext, so both
 * placements drive the same timer.
 */
const FocusSessionPanel = ({
    variant = 'full',
    boundTask = null,
    showTaskPicker = true,
    onOpenFullView = null
}) => {
    const focus = useFocus();
    const isCompact = variant === 'compact';
    const [optionsOpen, setOptionsOpen] = useState(!isCompact);

    const {
        focusEnabled,
        focusStatus,
        focusStartedAt,
        focusDurationMinutes,
        focusRemainingSeconds,
        focusProgressPercent,
        projectedEndTime,
        savingFocusSession,
        focusError,
        focusMessage,
        maxDurationMinutes,
        isAdHoc,
        adHocTitle,
        setAdHocTitle,
        changeMode,
        currentTasks,
        selectedTask,
        selectedTaskId,
        selectTask,
        focusRemainingTaskMinutes,
        focusCategory,
        setFocusCategory,
        customCategory,
        setCustomCategory,
        focusGoal,
        setFocusGoal,
        handleFocusDurationChange,
        handleFocusDurationBlur,
        startFocusMode,
        stopFocusMode,
        pauseFocusMode,
        resumeFocusMode,
        toggleFocusEnabled
    } = focus;

    const isRunning = focusStatus !== 'idle';
    const locked = Boolean(focusStartedAt);

    // Today's Dashboard owns which task is "now"; adopt it while idle so the
    // user never has to pick the obvious one.
    useEffect(() => {
        if (isCompact && !isAdHoc && focusStatus === 'idle' && boundTask && boundTask.id !== selectedTaskId) {
            selectTask(boundTask);
        }
    }, [boundTask, focusStatus, isAdHoc, isCompact, selectTask, selectedTaskId]);

    const renderTaskBinding = () => {
        if (isAdHoc) {
            return (
                <label className="focus-adhoc-field">
                    <span className="muted">What are you focusing on?</span>
                    <input
                        className="input"
                        type="text"
                        placeholder="e.g. Review pull requests"
                        value={adHocTitle}
                        onChange={(event) => setAdHocTitle(event.target.value)}
                        disabled={locked}
                        maxLength={255}
                    />
                    <span className="focus-adhoc-hint">
                        Saved as a completed task when the session ends.
                    </span>
                </label>
            );
        }

        if (currentTasks.length === 0) {
            return (
                <div className="focus-task-empty">
                    No active task right now. Switch to a free session to focus anyway.
                </div>
            );
        }

        return (
            <>
                {showTaskPicker && currentTasks.length > 1 && (
                    <label className="focus-task-select">
                        <span className="muted">Choose active task</span>
                        <select
                            value={selectedTaskId || ''}
                            onChange={(event) => {
                                const nextId = event.target.value || null;
                                selectTask(currentTasks.find((task) => task.id === nextId) || null);
                            }}
                            disabled={isRunning}
                        >
                            <option value="">Select a task</option>
                            {currentTasks.map((task) => (
                                <option key={task.id} value={task.id}>{task.title}</option>
                            ))}
                        </select>
                    </label>
                )}

                {selectedTask && (
                    <div className="focus-task-card">
                        <div>
                            <h4>{selectedTask.title}</h4>
                            {selectedTask.description && !isCompact && (
                                <p className="muted">{selectedTask.description}</p>
                            )}
                            <div className="focus-task-meta">
                                <span>⏰ {selectedTask.slot_start_time?.slice(0, 5)} - {selectedTask.slot_end_time?.slice(0, 5)}</span>
                                <span className={`task-priority priority-${selectedTask.priority || 'medium'}`}>
                                    {selectedTask.priority || 'medium'}
                                </span>
                            </div>
                        </div>
                        <div className="focus-task-status">
                            <span className={`task-status-badge ${selectedTask.status === 'in_progress' ? 'status-current' : 'status-upcoming'}`}>
                                {selectedTask.status === 'in_progress' ? 'In Progress' : 'Pending'}
                            </span>
                            {focusRemainingTaskMinutes && (
                                <span className="focus-task-remaining">{focusRemainingTaskMinutes} min left</span>
                            )}
                        </div>
                    </div>
                )}
            </>
        );
    };

    const renderOptions = () => (
        <>
            <div className="focus-settings-row">
                <label htmlFor={`focus-duration-${variant}`} className="muted">Session target (minutes)</label>
                <input
                    id={`focus-duration-${variant}`}
                    className="input focus-duration-input"
                    type="number"
                    min="1"
                    max={maxDurationMinutes}
                    value={focusDurationMinutes}
                    onChange={handleFocusDurationChange}
                    onBlur={handleFocusDurationBlur}
                    disabled={locked}
                />
            </div>

            <div className="focus-metadata-grid">
                <label className="focus-metadata-field">
                    <span className="muted">Category</span>
                    <div className="focus-category-grid" aria-label="Focus category">
                        {FOCUS_CATEGORY_OPTIONS.map((option) => {
                            const isCustom = option === 'Custom';
                            const selected = isCustom ? Boolean(customCategory) : focusCategory === option;
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    className={`focus-category-chip ${selected ? 'is-selected' : ''}`}
                                    onClick={() => {
                                        if (locked) return;
                                        if (isCustom) {
                                            setFocusCategory(customCategory || '');
                                        } else {
                                            setCustomCategory('');
                                            setFocusCategory(selected ? '' : option);
                                        }
                                    }}
                                    disabled={locked}
                                >
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                    {(customCategory || (!FOCUS_CATEGORY_OPTIONS.includes(focusCategory) && focusCategory)) && (
                        <input
                            className="input focus-category-custom"
                            type="text"
                            placeholder="Type a custom category"
                            value={customCategory}
                            onChange={(event) => {
                                setCustomCategory(event.target.value);
                                setFocusCategory(event.target.value);
                            }}
                            disabled={locked}
                        />
                    )}
                </label>
                <label className="focus-metadata-field">
                    <span className="muted">Set your focus goal</span>
                    <input
                        className="input"
                        type="text"
                        placeholder="Finish chapter 4, close inbox, etc."
                        value={focusGoal}
                        onChange={(event) => setFocusGoal(event.target.value)}
                        disabled={locked}
                    />
                    <div className="focus-goal-presets" aria-label="Focus goal presets">
                        {FOCUS_GOAL_PRESETS.map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                className="focus-goal-chip"
                                onClick={() => { if (!locked) setFocusGoal(preset); }}
                                disabled={locked}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                </label>
            </div>
        </>
    );

    return (
        <section className={`card focus-session-panel focus-session-panel--${variant}`}>
            <div className="focus-session-panel-header">
                <div>
                    <h2>{isCompact ? 'Focus Mode' : 'Focus Session'}</h2>
                    <span className="muted">
                        {isCompact ? 'Lock in on what you are doing right now.' : 'Set your target and hit start.'}
                    </span>
                </div>
                <label className="focus-toggle">
                    <input
                        className="focus-toggle-input"
                        type="checkbox"
                        checked={focusEnabled}
                        onChange={(event) => toggleFocusEnabled(event.target.checked)}
                        disabled={savingFocusSession}
                    />
                    <span className="focus-toggle-track">
                        <span className="focus-toggle-thumb" />
                    </span>
                    <span className="focus-toggle-label">{focusEnabled ? 'Enabled' : 'Enable'}</span>
                </label>
            </div>

            {!focusEnabled ? (
                <p className="muted focus-disabled">
                    Enable focus mode to start a session and track your time.
                </p>
            ) : (
                <>
                    <div className="focus-mode-switch" role="group" aria-label="Focus session type">
                        <button
                            type="button"
                            className={`focus-mode-chip ${!isAdHoc ? 'is-selected' : ''}`}
                            onClick={() => changeMode('task')}
                            disabled={isRunning}
                        >
                            Scheduled task
                        </button>
                        <button
                            type="button"
                            className={`focus-mode-chip ${isAdHoc ? 'is-selected' : ''}`}
                            onClick={() => changeMode('adhoc')}
                            disabled={isRunning}
                        >
                            Free session
                        </button>
                    </div>

                    <div className="focus-task-panel">
                        {renderTaskBinding()}
                    </div>

                    {isCompact ? (
                        <div className="focus-options-disclosure">
                            <button
                                type="button"
                                className="focus-options-toggle"
                                onClick={() => setOptionsOpen((open) => !open)}
                                aria-expanded={optionsOpen}
                            >
                                {optionsOpen ? 'Hide session options' : 'Session options'}
                            </button>
                            {optionsOpen && renderOptions()}
                        </div>
                    ) : renderOptions()}

                    <div className="focus-live-box">
                        <div className="focus-timer-row">
                            <p className="focus-timer">{formatElapsed(focusRemainingSeconds)}</p>
                            <div className="focus-progress-ring" style={{ '--progress': `${focusProgressPercent}%` }}>
                                <span>{Math.round(focusProgressPercent)}%</span>
                            </div>
                        </div>
                        <div className="focus-timer-meta">
                            <span>Started: {focusStartedAt ? new Date(focusStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                            <span>Ends: {projectedEndTime ? projectedEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                            <span>Total: {focusDurationMinutes} min</span>
                        </div>
                    </div>

                    <div className="focus-actions">
                        {focusStatus === 'idle' ? (
                            <button className="btn btn-primary" type="button" onClick={startFocusMode}>
                                Start Focus
                            </button>
                        ) : (
                            <div className="focus-action-group">
                                {focusStatus === 'running' ? (
                                    <button className="btn btn-outline" type="button" onClick={pauseFocusMode}>
                                        Pause
                                    </button>
                                ) : (
                                    <button className="btn btn-secondary" type="button" onClick={resumeFocusMode}>
                                        Resume
                                    </button>
                                )}
                                <button className="btn btn-danger" type="button" onClick={stopFocusMode} disabled={savingFocusSession}>
                                    {savingFocusSession ? 'Saving...' : 'Stop Focus'}
                                </button>
                            </div>
                        )}
                        {isCompact && onOpenFullView && (
                            <button className="btn btn-secondary focus-open-full" type="button" onClick={onOpenFullView}>
                                Focus insights
                            </button>
                        )}
                    </div>

                    {focusError && <p className="dashboard-error">{focusError}</p>}
                    {focusMessage && <div className="focus-complete-banner">{focusMessage}</div>}
                </>
            )}
        </section>
    );
};

export default FocusSessionPanel;
